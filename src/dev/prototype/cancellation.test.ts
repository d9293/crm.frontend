/**
 * Cancellation rules in the prototype simulation — BR-07, BR-08, BR-09.
 *
 * As with the hold tests, these validate the *simulation*, so the design
 * review demonstrates the agreed behaviour rather than something plausible.
 * The real rules are enforced by the server in a transaction; AC-05 and AC-06
 * are proven there, not here.
 *
 * Kept separate from `fakeServer.test.ts` because the two read as distinct
 * specifications: the hold is a race against a clock, the cutoff is a
 * deadline.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CANCELLATION_CUTOFF_HOURS, FakeServer, instantFor } from './fakeServer'

const DATE = '2026-10-26'
const CUSTOMER = { customerId: 100, customerDisplayName: 'Клиент А' }

/** A confirmed booking, ready to cancel. */
function confirmedBooking(server: FakeServer, startLocal = '15:00', endLocal = '16:30') {
  const created = server.createRequest({
    resourceIds: [11],
    startsAt: instantFor(DATE, startLocal),
    endsAt: instantFor(DATE, endLocal),
    idempotencyKey: crypto.randomUUID(),
    ...CUSTOMER,
  })
  if (!created.ok) throw new Error('expected request to succeed')

  const confirmed = server.confirm(created.reservation.id, created.reservation.version)
  if (!confirmed.ok) throw new Error('expected confirmation to succeed')

  return confirmed.reservation
}

function slotAvailable(server: FakeServer, localTime: string): boolean {
  const availability = server.getAvailability(DATE, 90)
  const slot = availability.slots.find(
    (candidate) =>
      candidate.resource_id === 11 && candidate.starts_at === instantFor(DATE, localTime),
  )
  return slot?.is_available ?? false
}

describe('the cutoff rule', () => {
  it('is two hours, per BR-07', () => {
    expect(CANCELLATION_CUTOFF_HOURS).toBe(2)
  })
})

describe('AC-05 — the two-hour cancellation cutoff', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('accepts a request at exactly two hours before start', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)

    // For a 15:00 start the deadline is 13:00. The rule is
    // `now <= starts_at - 2h`, so exactly 13:00 is still accepted.
    vi.setSystemTime(new Date(instantFor(DATE, '13:00')))
    const result = server.requestCancellation(booking.id, 'Не смогу прийти')

    expect(result.ok).toBe(true)
  })

  it('refuses one second after the cutoff', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)

    vi.setSystemTime(new Date(new Date(instantFor(DATE, '13:00')).getTime() + 1000))
    const result = server.requestCancellation(booking.id, null)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('CANCELLATION_CUTOFF_PASSED')
    // Both instants are reported, so the UI can say precisely what was missed
    // instead of refusing without explanation.
    expect(result.cutoffAt).toBe(new Date(instantFor(DATE, '13:00')).toISOString())
    expect(result.serverTime).toBeTruthy()
  })

  it('enforces the cutoff at submission, not when the form was opened', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)

    // Well before the cutoff the action is legitimately offered.
    expect(server.get(booking.id, 'customer')?.can_request_cancellation).toBe(true)

    // Submitting an hour late is refused regardless of what the page showed
    // when it loaded.
    vi.setSystemTime(new Date(instantFor(DATE, '14:00')))
    expect(server.requestCancellation(booking.id, null).ok).toBe(false)
  })

  it('withdraws the action once the cutoff passes', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)

    vi.setSystemTime(new Date(instantFor(DATE, '14:00')))
    // Server-computed, so the control disappears even if the browser clock is
    // wrong (UX-03).
    expect(server.get(booking.id, 'customer')?.can_request_cancellation).toBe(false)
  })

  it('publishes the exact cutoff so the client never computes it', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)

    expect(server.get(booking.id, 'customer')?.cancellation_cutoff_at).toBe(
      new Date(instantFor(DATE, '13:00')).toISOString(),
    )
  })

  it('refuses to cancel a booking that is not confirmed', () => {
    const server = new FakeServer()
    const created = server.createRequest({
      resourceIds: [11],
      startsAt: instantFor(DATE, '15:00'),
      endsAt: instantFor(DATE, '16:30'),
      idempotencyKey: crypto.randomUUID(),
      ...CUSTOMER,
    })
    if (!created.ok) throw new Error('expected success')

    // Still pending_confirmation: there is no booking to cancel yet.
    const result = server.requestCancellation(created.reservation.id, null)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('INVALID_TRANSITION')
  })

  it('returns the existing request rather than creating a duplicate', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)

    const first = server.requestCancellation(booking.id, 'Первый')
    const second = server.requestCancellation(booking.id, 'Второй')

    if (!first.ok || !second.ok) throw new Error('expected both to succeed')
    expect(second.existing).toBe(true)
    expect(second.request.id).toBe(first.request.id)
    expect(server.listCancellations('employee').items).toHaveLength(1)
  })
})

describe('AC-06 — pending cancellation and the decision', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps the court occupied while the request is pending', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)
    server.requestCancellation(booking.id, null)

    const after = server.get(booking.id, 'customer')
    // Still confirmed, with both states visible together rather than
    // collapsed into one ambiguous status (UX-04, BR-08).
    expect(after?.state).toBe('confirmed')
    expect(after?.cancellation_request_state).toBe('pending')
    expect(slotAvailable(server, '15:00')).toBe(false)
  })

  it('releases the court exactly once on approval', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)
    const requested = server.requestCancellation(booking.id, null)
    if (!requested.ok) throw new Error('expected success')

    const approved = server.approveCancellation(
      requested.request.id,
      requested.request.version,
      null,
    )

    expect(approved.ok).toBe(true)
    expect(server.get(booking.id, 'customer')?.state).toBe('canceled')
    expect(slotAvailable(server, '15:00')).toBe(true)

    // A second approval must not release anything again.
    expect(server.approveCancellation(requested.request.id, 999, null).ok).toBe(false)
  })

  it('leaves the booking confirmed and occupying its court when rejected', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)
    const requested = server.requestCancellation(booking.id, null)
    if (!requested.ok) throw new Error('expected success')

    const rejected = server.rejectCancellation(
      requested.request.id,
      requested.request.version,
      'Отмена невозможна',
    )

    expect(rejected.ok).toBe(true)

    const after = server.get(booking.id, 'customer')
    expect(after?.state).toBe('confirmed')
    expect(after?.cancellation_request_state).toBe('rejected')
    expect(slotAvailable(server, '15:00')).toBe(false)
  })

  it('creates no refund on approval, per BR-09', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)

    expect(booking.financial_summary?.charged_minor_units ?? 0).toBeGreaterThan(0)

    const requested = server.requestCancellation(booking.id, null)
    if (!requested.ok) throw new Error('expected success')
    server.approveCancellation(requested.request.id, requested.request.version, null)

    // Releasing the court moves no money. Any refund is a separate, explicit
    // act under D-09.
    const after = server.get(booking.id, 'employee')
    expect(after?.state).toBe('canceled')
    expect(after?.financial_summary?.received_minor_units ?? 0).toBe(0)
  })

  it('yields one outcome when two administrators decide', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)
    const requested = server.requestCancellation(booking.id, null)
    if (!requested.ok) throw new Error('expected success')

    const first = server.approveCancellation(
      requested.request.id,
      requested.request.version,
      null,
    )
    const second = server.rejectCancellation(
      requested.request.id,
      requested.request.version,
      null,
    )

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.code).toBe('INVALID_TRANSITION')
    // The committed approval stands.
    expect(server.get(booking.id, 'customer')?.state).toBe('canceled')
  })

  it('offers no decision action to a customer, and no name either', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)
    server.requestCancellation(booking.id, null)

    const asCustomer = server.listCancellations('customer').items[0]
    const asEmployee = server.listCancellations('employee').items[0]

    expect(asCustomer.can_decide).toBe(false)
    expect(asCustomer.customer_display_name).toBeNull()
    expect(asEmployee.can_decide).toBe(true)
    expect(asEmployee.customer_display_name).toBe('Клиент А')
  })

  it('records the start time as it was when submitted', () => {
    vi.setSystemTime(new Date(instantFor(DATE, '09:00')))
    const server = new FakeServer()
    const booking = confirmedBooking(server)
    const requested = server.requestCancellation(booking.id, null)
    if (!requested.ok) throw new Error('expected success')

    // Stored on the request so a later reschedule cannot silently change what
    // the customer asked to cancel.
    expect(requested.request.reservation_starts_at).toBe(booking.starts_at)
  })
})
