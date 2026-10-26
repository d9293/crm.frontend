/**
 * In-memory simulation of the S3 contract, for the design prototype only.
 *
 * **This is not a reference implementation and is not shipped.** The real
 * rules are enforced by the server inside a database transaction with row
 * locks and an exclusion constraint; nothing here proves anything about that.
 * `frontend.md` is explicit that a ticket cannot be closed on mocked data.
 *
 * What it *is* for: letting the owner and both teams walk the confirmed
 * journey — request, five-minute hold, employee decision, customer outcome —
 * before the backend exists, which is the S3 design deliverable in
 * `ui-ux.md` section 12.
 *
 * It implements the real rules faithfully enough for the UX to be judged
 * honestly:
 *
 *  - The hold runs from acceptance time, and a retry with the same
 *    idempotency key returns the original without extending it.
 *  - Expiry is evaluated lazily on every read, from the clock, with no
 *    sweeper anywhere. This is what AC-02 demands of the real server: an
 *    expired hold stops blocking even if no cleanup job has run.
 *  - Confirmation succeeds only strictly before expiry. At the expiry instant
 *    it already fails.
 *  - Allocation is all-or-nothing, and a conflict reports the exact
 *    conflicting intervals.
 */

import type {
  AvailabilityResponse,
  AvailabilitySlot,
  Id,
  Reservation,
  ReservationState,
  Resource,
  ResourceAllocation,
} from '../../api/types'
import { businessTimeToInstant, courtDayBounds, intervalsOverlap } from '../../lib/time'
import { BUSINESS_TIMEZONE } from '../../lib/format'

/** Confirmed by BR-04. Shortened only for demonstration — see options. */
export const REAL_HOLD_SECONDS = 300

const LOCATION_ID = 1

const OPENING_HOURS: Resource['opening_hours'] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  opens_at: '07:00',
  closes_at: '00:00',
  closes_next_day: true,
}))

export const PROTOTYPE_RESOURCES: Resource[] = [
  {
    id: 11,
    location_id: LOCATION_ID,
    name: 'Корт 1',
    kind: 'tennis_court',
    placement: 'indoor',
    display_order: 1,
    default_capacity: 12,
    is_active: true,
    opening_hours: OPENING_HOURS,
    version: 1,
    archived_at: null,
  },
  {
    id: 12,
    location_id: LOCATION_ID,
    name: 'Корт 2',
    kind: 'tennis_court',
    placement: 'indoor',
    display_order: 2,
    default_capacity: 12,
    is_active: true,
    opening_hours: OPENING_HOURS,
    version: 1,
    archived_at: null,
  },
  {
    id: 13,
    location_id: LOCATION_ID,
    name: 'Корт 3',
    kind: 'tennis_court',
    placement: 'outdoor',
    display_order: 3,
    default_capacity: 12,
    is_active: true,
    opening_hours: OPENING_HOURS,
    version: 1,
    archived_at: null,
  },
]

/** Prototype pricing. GATE D-10 — the real tariff structure is undecided. */
const PRICE_PER_HOUR_MINOR_UNITS = 1_000_000

interface Record_ {
  id: Id
  state: ReservationState
  customerId: Id
  customerDisplayName: string
  requestedAt: Date
  holdExpiresAt: Date
  startsAt: Date
  endsAt: Date
  resourceIds: Id[]
  version: number
  decidedAt: Date | null
  decisionReason: string | null
  idempotencyKey: string | null
}

export interface FakeServerOptions {
  /**
   * Hold length. Defaults to the confirmed 300 seconds. The prototype exposes
   * a shorter value so expiry can actually be demonstrated in a review
   * session — the UI labels it loudly when it is not 300.
   */
  holdSeconds?: number
}

export class FakeServer {
  private records: Record_[] = []
  private nextId = 5120
  private readonly holdSeconds: number

  constructor(options: FakeServerOptions = {}) {
    this.holdSeconds = options.holdSeconds ?? REAL_HOLD_SECONDS
  }

  now(): Date {
    return new Date()
  }

  /**
   * Materializes expiry.
   *
   * Called at the start of every operation, exactly as the real server
   * deactivates logically expired holds inside the allocation transaction
   * before inspecting overlaps. There is deliberately no background timer: if
   * this simulation needed one to behave correctly, it would be modelling the
   * rule wrongly.
   */
  private settleExpiries(): void {
    const now = this.now().getTime()
    for (const record of this.records) {
      if (record.state === 'pending_confirmation' && record.holdExpiresAt.getTime() <= now) {
        record.state = 'expired'
        record.version += 1
      }
    }
  }

  /** Allocations that currently occupy a resource. */
  private activeRecords(): Record_[] {
    return this.records.filter(
      (record) => record.state === 'pending_confirmation' || record.state === 'confirmed',
    )
  }

  getAvailability(localDate: string, durationMinutes: number): AvailabilityResponse {
    this.settleExpiries()

    const { opensAt, closesAt } = courtDayBounds(localDate)
    const slots: AvailabilitySlot[] = []
    const stepMs = 30 * 60 * 1000
    const durationMs = durationMinutes * 60 * 1000

    for (const resource of PROTOTYPE_RESOURCES) {
      for (let start = opensAt.getTime(); start + durationMs <= closesAt.getTime(); start += stepMs) {
        const slotStart = new Date(start)
        const slotEnd = new Date(start + durationMs)

        const occupied = this.activeRecords().some(
          (record) =>
            record.resourceIds.includes(resource.id) &&
            intervalsOverlap(slotStart, slotEnd, record.startsAt, record.endsAt),
        )

        slots.push({
          resource_id: resource.id,
          starts_at: slotStart.toISOString(),
          ends_at: slotEnd.toISOString(),
          is_available: !occupied,
          // Coarse on purpose: a customer may learn a slot is taken, never
          // that someone else is mid-request.
          unavailable_reason: occupied ? 'occupied' : null,
        })
      }
    }

    return {
      location_id: LOCATION_ID,
      date: localDate,
      timezone: BUSINESS_TIMEZONE,
      server_time: this.now().toISOString(),
      resources: PROTOTYPE_RESOURCES,
      slots,
      durations: [
        { minutes: 60, is_allowed: true },
        { minutes: 90, is_allowed: true },
        { minutes: 120, is_allowed: true },
      ],
    }
  }

  /**
   * Customer request. Creates a hold, or fails with the conflicting intervals.
   */
  createRequest(input: {
    resourceIds: Id[]
    startsAt: string
    endsAt: string
    customerId: Id
    customerDisplayName: string
    idempotencyKey: string
  }):
    | { ok: true; replayed: boolean; reservation: Reservation }
    | { ok: false; code: 'SLOT_UNAVAILABLE'; conflicts: ResourceAllocation[]; serverTime: string } {
    this.settleExpiries()

    // Idempotent replay: the original record, with its original expiry. The
    // hold is never extended by retrying.
    const existing = this.records.find(
      (record) => record.idempotencyKey === input.idempotencyKey,
    )
    if (existing) {
      return { ok: true, replayed: true, reservation: this.toContract(existing, 'customer') }
    }

    const startsAt = new Date(input.startsAt)
    const endsAt = new Date(input.endsAt)

    const conflicts: ResourceAllocation[] = []
    for (const record of this.activeRecords()) {
      for (const resourceId of record.resourceIds) {
        if (
          input.resourceIds.includes(resourceId) &&
          intervalsOverlap(startsAt, endsAt, record.startsAt, record.endsAt)
        ) {
          conflicts.push({
            resource_id: resourceId,
            resource_name: resourceName(resourceId),
            starts_at: record.startsAt.toISOString(),
            ends_at: record.endsAt.toISOString(),
          })
        }
      }
    }

    // All-or-nothing: one conflicting resource fails the whole request and
    // writes nothing.
    if (conflicts.length > 0) {
      return {
        ok: false,
        code: 'SLOT_UNAVAILABLE',
        conflicts,
        serverTime: this.now().toISOString(),
      }
    }

    const acceptedAt = this.now()
    const record: Record_ = {
      id: this.nextId++,
      state: 'pending_confirmation',
      customerId: input.customerId,
      customerDisplayName: input.customerDisplayName,
      requestedAt: acceptedAt,
      // Expiry is the server's own acceptance time plus the hold, never a
      // client-supplied value.
      holdExpiresAt: new Date(acceptedAt.getTime() + this.holdSeconds * 1000),
      startsAt,
      endsAt,
      resourceIds: [...input.resourceIds],
      version: 1,
      decidedAt: null,
      decisionReason: null,
      idempotencyKey: input.idempotencyKey,
    }

    this.records.push(record)
    return { ok: true, replayed: false, reservation: this.toContract(record, 'customer') }
  }

  confirm(
    id: Id,
    expectedVersion: number,
  ):
    | { ok: true; reservation: Reservation }
    | {
        ok: false
        code: 'HOLD_EXPIRED' | 'INVALID_TRANSITION' | 'VERSION_CONFLICT' | 'NOT_FOUND'
        currentState?: ReservationState
        currentVersion?: number
        serverTime: string
      } {
    return this.decide(id, expectedVersion, 'confirmed', null)
  }

  reject(id: Id, expectedVersion: number, reason: string | null) {
    return this.decide(id, expectedVersion, 'rejected', reason)
  }

  private decide(
    id: Id,
    expectedVersion: number,
    outcome: 'confirmed' | 'rejected',
    reason: string | null,
  ):
    | { ok: true; reservation: Reservation }
    | {
        ok: false
        code: 'HOLD_EXPIRED' | 'INVALID_TRANSITION' | 'VERSION_CONFLICT' | 'NOT_FOUND'
        currentState?: ReservationState
        currentVersion?: number
        serverTime: string
      } {
    // Expiry is settled first, so a decision can never act on a hold that has
    // already lapsed.
    this.settleExpiries()
    const serverTime = this.now().toISOString()

    const record = this.records.find((candidate) => candidate.id === id)
    if (!record) return { ok: false, code: 'NOT_FOUND', serverTime }

    if (record.state === 'expired') {
      return {
        ok: false,
        code: 'HOLD_EXPIRED',
        currentState: record.state,
        currentVersion: record.version,
        serverTime,
      }
    }

    if (record.state !== 'pending_confirmation') {
      // Another employee already decided. The committed outcome stands.
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        currentState: record.state,
        currentVersion: record.version,
        serverTime,
      }
    }

    if (record.version !== expectedVersion) {
      return {
        ok: false,
        code: 'VERSION_CONFLICT',
        currentState: record.state,
        currentVersion: record.version,
        serverTime,
      }
    }

    // Strictly before: at exactly the expiry instant the hold is inactive.
    // settleExpiries uses `<=`, so this is already covered — kept explicit
    // because it is the rule most easily lost in a refactor.
    if (this.now().getTime() >= record.holdExpiresAt.getTime()) {
      record.state = 'expired'
      record.version += 1
      return {
        ok: false,
        code: 'HOLD_EXPIRED',
        currentState: record.state,
        currentVersion: record.version,
        serverTime,
      }
    }

    record.state = outcome
    record.decidedAt = this.now()
    record.decisionReason = reason
    record.version += 1

    // Rejection releases the allocation immediately: activeRecords() stops
    // counting it, so the slot frees without waiting for any sweep.
    return { ok: true, reservation: this.toContract(record, 'employee') }
  }

  list(options: { viewer: 'customer' | 'employee'; customerId?: Id; states?: ReservationState[] }): {
    items: Reservation[]
    serverTime: string
  } {
    this.settleExpiries()

    let items = this.records.slice()

    if (options.viewer === 'customer') {
      // Scope derived from identity, never from a parameter a client chooses.
      items = items.filter((record) => record.customerId === options.customerId)
    }

    if (options.states) {
      items = items.filter((record) => options.states!.includes(record.state))
    }

    // Pending requests sort by nearest expiry, so the most urgent is first
    // (ui-ux.md section 6). Everything else sorts by start time.
    items.sort((a, b) => {
      if (a.state === 'pending_confirmation' && b.state === 'pending_confirmation') {
        return a.holdExpiresAt.getTime() - b.holdExpiresAt.getTime()
      }
      if (a.state === 'pending_confirmation') return -1
      if (b.state === 'pending_confirmation') return 1
      return a.startsAt.getTime() - b.startsAt.getTime()
    })

    return {
      items: items.map((record) => this.toContract(record, options.viewer)),
      serverTime: this.now().toISOString(),
    }
  }

  get(id: Id, viewer: 'customer' | 'employee'): Reservation | null {
    this.settleExpiries()
    const record = this.records.find((candidate) => candidate.id === id)
    return record ? this.toContract(record, viewer) : null
  }

  /** Seeds an occupied slot, so a conflict can be demonstrated. */
  seedConfirmed(input: { resourceIds: Id[]; startsAt: string; endsAt: string }): void {
    const now = this.now()
    this.records.push({
      id: this.nextId++,
      state: 'confirmed',
      customerId: 999,
      customerDisplayName: 'Другой клиент',
      requestedAt: now,
      holdExpiresAt: now,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      resourceIds: [...input.resourceIds],
      version: 1,
      decidedAt: now,
      decisionReason: null,
      idempotencyKey: null,
    })
  }

  private toContract(record: Record_, viewer: 'customer' | 'employee'): Reservation {
    const now = this.now()
    const pending = record.state === 'pending_confirmation'
    const live = pending && now.getTime() < record.holdExpiresAt.getTime()

    return {
      id: record.id,
      state: record.state,
      location_id: LOCATION_ID,
      starts_at: record.startsAt.toISOString(),
      ends_at: record.endsAt.toISOString(),
      allocations: record.resourceIds.map((resourceId) => ({
        resource_id: resourceId,
        resource_name: resourceName(resourceId),
        starts_at: record.startsAt.toISOString(),
        ends_at: record.endsAt.toISOString(),
      })),
      hold_expires_at: pending ? record.holdExpiresAt.toISOString() : null,
      // A customer never sees another customer's name; the employee view does.
      customer_display_name: viewer === 'employee' ? record.customerDisplayName : null,
      customer_id: record.customerId,
      requested_at: record.requestedAt.toISOString(),
      decided_at: record.decidedAt?.toISOString() ?? null,
      decision_reason: record.decisionReason,
      price_snapshot: {
        currency: 'KZT',
        total_minor_units: priceFor(record.startsAt, record.endsAt, record.resourceIds.length),
        lines: [
          {
            label: `Аренда корта, ${durationMinutes(record.startsAt, record.endsAt)} минут`,
            quantity: record.resourceIds.length,
            unit_price_minor_units: priceFor(record.startsAt, record.endsAt, 1),
            amount_minor_units: priceFor(record.startsAt, record.endsAt, record.resourceIds.length),
          },
        ],
      },
      // Confirmed does not mean paid (BR-06). The prototype shows an
      // outstanding balance on a confirmed booking deliberately.
      financial_summary:
        record.state === 'confirmed'
          ? {
              charged_minor_units: priceFor(record.startsAt, record.endsAt, record.resourceIds.length),
              received_minor_units: 0,
              outstanding_minor_units: priceFor(
                record.startsAt,
                record.endsAt,
                record.resourceIds.length,
              ),
            }
          : null,
      server_time: now.toISOString(),
      // Server's judgement, not the client's. False for an expired hold even
      // if a client misreads the timestamps.
      can_confirm: viewer === 'employee' && live,
      can_reject: viewer === 'employee' && live,
      cancellation_request_state: null,
      version: record.version,
    }
  }
}

function resourceName(id: Id): string {
  return PROTOTYPE_RESOURCES.find((resource) => resource.id === id)?.name ?? `Ресурс ${id}`
}

function durationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
}

function priceFor(startsAt: Date, endsAt: Date, resourceCount: number): number {
  const hours = durationMinutes(startsAt, endsAt) / 60
  // Integer minor units throughout — never a float holding money.
  return Math.round(hours * PRICE_PER_HOUR_MINOR_UNITS) * resourceCount
}

/** Convenience for the prototype's seeded scenario. */
export function instantFor(localDate: string, localTime: string): string {
  return businessTimeToInstant(localDate, localTime).toISOString()
}
