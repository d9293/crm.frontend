/**
 * Tests for the prototype simulation.
 *
 * These do **not** validate the real system — that needs integration tests
 * against PostgreSQL with concurrent transactions, as `backend.md` requires.
 * What they do is keep the prototype honest: a design review that demonstrates
 * the wrong behaviour is worse than no prototype, because the owner would
 * approve a journey the real server will not produce.
 *
 * They also read as an executable statement of the AC-01 to AC-04 rules, which
 * is useful to hand the backend team alongside the contract.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeServer, REAL_HOLD_SECONDS, instantFor } from './fakeServer'

const DATE = '2026-10-26'
const CUSTOMER = { customerId: 100, customerDisplayName: 'Клиент А' }

function request(server: FakeServer, overrides: Partial<Parameters<FakeServer['createRequest']>[0]> = {}) {
  return server.createRequest({
    resourceIds: [11],
    startsAt: instantFor(DATE, '09:00'),
    endsAt: instantFor(DATE, '10:30'),
    idempotencyKey: crypto.randomUUID(),
    ...CUSTOMER,
    ...overrides,
  })
}

describe('hold creation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sets expiry to acceptance time plus the confirmed five minutes', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()

    const result = request(server)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.reservation.state).toBe('pending_confirmation')
    expect(result.reservation.hold_expires_at).toBe('2026-10-26T03:05:00.000Z')
    expect(REAL_HOLD_SECONDS).toBe(300)
  })

  it('returns server_time so a client never needs its own clock', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()

    const result = request(server)
    if (!result.ok) throw new Error('expected success')

    expect(result.reservation.server_time).toBe('2026-10-26T03:00:00.000Z')
  })
})

describe('AC-01 — concurrent requests for the same slot', () => {
  it('gives one hold and reports a conflict to the other, with no partial write', () => {
    const server = new FakeServer()

    const first = request(server)
    const second = request(server, { customerId: 101, customerDisplayName: 'Клиент Б' })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (second.ok) return

    expect(second.code).toBe('SLOT_UNAVAILABLE')
    expect(second.conflicts).toHaveLength(1)
    expect(second.conflicts[0].resource_id).toBe(11)

    // Exactly one record exists: the failed request wrote nothing.
    const all = server.list({ viewer: 'employee' })
    expect(all.items).toHaveLength(1)
  })

  it('does not report another customer name in the conflict', () => {
    const server = new FakeServer()
    request(server)

    const blocked = request(server, { customerId: 101, customerDisplayName: 'Клиент Б' })
    if (blocked.ok) throw new Error('expected conflict')

    const serialized = JSON.stringify(blocked.conflicts)
    expect(serialized).not.toContain('Клиент')
  })

  it('fails the whole multi-court request when only one court conflicts', () => {
    const server = new FakeServer()
    request(server, { resourceIds: [11] })

    // Courts 11 and 12 together; 11 is taken. All-or-nothing.
    const multi = request(server, { resourceIds: [11, 12] })
    expect(multi.ok).toBe(false)

    // Court 12 must remain free: no partial allocation was made.
    const availability = server.getAvailability(DATE, 90)
    const court12At0900 = availability.slots.find(
      (slot) => slot.resource_id === 12 && slot.starts_at === instantFor(DATE, '09:00'),
    )
    expect(court12At0900?.is_available).toBe(true)
  })

  it('allows the same time on a different court', () => {
    const server = new FakeServer()
    expect(request(server, { resourceIds: [11] }).ok).toBe(true)
    expect(request(server, { resourceIds: [12] }).ok).toBe(true)
  })
})

describe('AC-07 — adjacent intervals', () => {
  it('permits a booking that starts exactly when another ends', () => {
    const server = new FakeServer()

    const earlier = request(server, {
      startsAt: instantFor(DATE, '10:00'),
      endsAt: instantFor(DATE, '11:00'),
    })
    const adjacent = request(server, {
      startsAt: instantFor(DATE, '11:00'),
      endsAt: instantFor(DATE, '12:00'),
    })

    expect(earlier.ok).toBe(true)
    expect(adjacent.ok).toBe(true)
  })

  it('offers evening slots, because the 00:00 close is the next date', () => {
    const server = new FakeServer()
    const availability = server.getAvailability(DATE, 60)

    // 23:00-00:00 must exist. Treating the close as same-day would drop it.
    const lastSlot = availability.slots
      .filter((slot) => slot.resource_id === 11)
      .at(-1)

    expect(lastSlot?.starts_at).toBe(instantFor(DATE, '23:00'))
    expect(lastSlot?.ends_at).toBe('2026-10-26T19:00:00.000Z')
  })
})

describe('idempotency', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('creates one hold for a repeated key and does not extend it', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()
    const key = crypto.randomUUID()

    const first = request(server, { idempotencyKey: key })
    if (!first.ok) throw new Error('expected success')

    // Two minutes later, the same command is retried.
    vi.setSystemTime(new Date('2026-10-26T03:02:00Z'))
    const replay = request(server, { idempotencyKey: key })
    if (!replay.ok) throw new Error('expected replay')

    expect(replay.replayed).toBe(true)
    expect(replay.reservation.id).toBe(first.reservation.id)
    // Original expiry stands. Retrying must never buy more time.
    expect(replay.reservation.hold_expires_at).toBe('2026-10-26T03:05:00.000Z')
    expect(server.list({ viewer: 'employee' }).items).toHaveLength(1)
  })
})

describe('AC-02 — no employee action for five minutes', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('frees the slot at expiry with no sweeper running', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()
    request(server)

    // Still held at 04:59.
    vi.setSystemTime(new Date('2026-10-26T03:04:59Z'))
    let availability = server.getAvailability(DATE, 90)
    let slot = availability.slots.find(
      (candidate) =>
        candidate.resource_id === 11 && candidate.starts_at === instantFor(DATE, '09:00'),
    )
    expect(slot?.is_available).toBe(false)

    // Free at 05:00. Nothing swept it: expiry is evaluated on read, which is
    // what makes this pass with the cleanup worker stopped.
    vi.setSystemTime(new Date('2026-10-26T03:05:00Z'))
    availability = server.getAvailability(DATE, 90)
    slot = availability.slots.find(
      (candidate) =>
        candidate.resource_id === 11 && candidate.starts_at === instantFor(DATE, '09:00'),
    )
    expect(slot?.is_available).toBe(true)
  })

  it('lets another customer book once the hold has lapsed', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()
    request(server)

    vi.setSystemTime(new Date('2026-10-26T03:05:01Z'))
    const later = request(server, { customerId: 101, customerDisplayName: 'Клиент Б' })
    expect(later.ok).toBe(true)
  })
})

describe('AC-03 — confirmation racing expiry', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('confirms while strictly before expiry', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    vi.setSystemTime(new Date('2026-10-26T03:04:59Z'))
    const confirmed = server.confirm(created.reservation.id, created.reservation.version)

    expect(confirmed.ok).toBe(true)
    if (!confirmed.ok) return
    expect(confirmed.reservation.state).toBe('confirmed')
  })

  it('refuses at exactly the expiry instant', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    // The boundary case the specification calls out: at the expiry instant the
    // hold is already inactive, not still live for one more millisecond.
    vi.setSystemTime(new Date('2026-10-26T03:05:00Z'))
    const confirmed = server.confirm(created.reservation.id, created.reservation.version)

    expect(confirmed.ok).toBe(false)
    if (confirmed.ok) return
    expect(confirmed.code).toBe('HOLD_EXPIRED')
    expect(confirmed.currentState).toBe('expired')
  })

  it('never confirms an expired request, however long after', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    vi.setSystemTime(new Date('2026-10-26T04:00:00Z'))
    const confirmed = server.confirm(created.reservation.id, created.reservation.version)
    expect(confirmed.ok).toBe(false)
  })

  it('yields one final outcome when two employees decide', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    const first = server.confirm(created.reservation.id, created.reservation.version)
    // The second employee acts on the version they last saw.
    const second = server.reject(created.reservation.id, created.reservation.version, null)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (second.ok) return
    // The committed outcome stands and is reported back.
    expect(second.code).toBe('INVALID_TRANSITION')
    expect(second.currentState).toBe('confirmed')
  })

  it('reports a version conflict to a stale client', () => {
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    const stale = server.confirm(created.reservation.id, created.reservation.version + 5)
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.code).toBe('VERSION_CONFLICT')
  })

  it('marks an expired request as not confirmable, for the UI', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    vi.setSystemTime(new Date('2026-10-26T03:05:00Z'))
    const read = server.get(created.reservation.id, 'employee')

    // can_confirm is the server's judgement, so a client cannot present an
    // expired request as actionable.
    expect(read?.can_confirm).toBe(false)
    expect(read?.state).toBe('expired')
  })
})

describe('AC-04 — confirmation without payment', () => {
  it('confirms an unpaid request and shows the balance separately', () => {
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    const confirmed = server.confirm(created.reservation.id, created.reservation.version)
    if (!confirmed.ok) throw new Error('expected confirmation')

    expect(confirmed.reservation.state).toBe('confirmed')
    // Reserved and unpaid at once: payment is not a reservation state.
    expect(confirmed.reservation.financial_summary?.outstanding_minor_units).toBeGreaterThan(0)
    expect(confirmed.reservation.financial_summary?.received_minor_units).toBe(0)
  })
})

describe('rejection', () => {
  it('releases the slot immediately, without waiting for a sweep', () => {
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    server.reject(created.reservation.id, created.reservation.version, 'Корт на обслуживании')

    const availability = server.getAvailability(DATE, 90)
    const slot = availability.slots.find(
      (candidate) =>
        candidate.resource_id === 11 && candidate.starts_at === instantFor(DATE, '09:00'),
    )
    expect(slot?.is_available).toBe(true)
  })

  it('keeps a repeated rejection harmless', () => {
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    const first = server.reject(created.reservation.id, created.reservation.version, null)
    if (!first.ok) throw new Error('expected rejection')

    const repeat = server.reject(created.reservation.id, first.reservation.version, null)
    expect(repeat.ok).toBe(false)
    expect(server.list({ viewer: 'employee' }).items).toHaveLength(1)
  })
})

describe('AC-11 — scope', () => {
  it('shows a customer only their own reservations', () => {
    const server = new FakeServer()
    request(server, { customerId: 100, customerDisplayName: 'Клиент А' })
    request(server, {
      customerId: 101,
      customerDisplayName: 'Клиент Б',
      resourceIds: [12],
    })

    const mine = server.list({ viewer: 'customer', customerId: 100 })
    expect(mine.items).toHaveLength(1)
    expect(mine.items[0].customer_id).toBe(100)
  })

  it('withholds the customer name from a customer-scoped read', () => {
    const server = new FakeServer()
    const created = request(server)
    if (!created.ok) throw new Error('expected success')

    expect(server.get(created.reservation.id, 'customer')?.customer_display_name).toBeNull()
    expect(server.get(created.reservation.id, 'employee')?.customer_display_name).toBe(
      'Клиент А',
    )
  })
})

describe('approval queue ordering', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('puts the nearest expiry first', () => {
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
    const server = new FakeServer()
    const older = request(server, { resourceIds: [11] })

    vi.setSystemTime(new Date('2026-10-26T03:01:00Z'))
    request(server, { resourceIds: [12] })

    const queue = server.list({ viewer: 'employee', states: ['pending_confirmation'] })
    if (!older.ok) throw new Error('expected success')

    // The request submitted first expires first, so an employee sees the most
    // urgent decision at the top.
    expect(queue.items[0].id).toBe(older.reservation.id)
  })
})
