/**
 * StatusBadge — `ui-ux.md` section 9.
 *
 * Explicit enum-to-label mapping with a semantic tone. Two rules:
 *
 *  - Status must never be conveyed by colour alone, so the label text is
 *    always rendered. The tone is reinforcement, not the message.
 *  - Request, booking, cancellation, payment and membership states are
 *    SEPARATE vocabularies with their own badges. Collapsing them would let
 *    «Подтверждена» (booking) and «Оплачено» (payment) occupy one column, and
 *    `README.md` section 6 is explicit that paid/unpaid is never a reservation
 *    state.
 *
 * A confirmed-but-unpaid booking therefore renders two badges, which is the
 * distinct combination UX-04 requires.
 */

import './components.css'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

/** Request lifecycle: `pending_confirmation → confirmed | rejected | expired`. */
export type RequestState = 'pending_confirmation' | 'confirmed' | 'rejected' | 'expired'

/** Booking occupancy state. Never carries payment meaning. */
export type BookingState = 'confirmed' | 'canceled' | 'completed'

/** Separate record: `pending → approved | rejected`. */
export type CancellationState = 'pending' | 'approved' | 'rejected'

/** Financial state, independent of any reservation state. */
export type PaymentState = 'unpaid' | 'partly_paid' | 'paid' | 'refunded' | 'credit'

export type MembershipState = 'pending_activation' | 'active' | 'expired' | 'frozen' | 'revoked'

interface Entry {
  label: string
  tone: BadgeTone
}

const REQUEST: Record<RequestState, Entry> = {
  pending_confirmation: { label: 'Ожидает подтверждения', tone: 'warning' },
  confirmed: { label: 'Подтверждена', tone: 'success' },
  rejected: { label: 'Отклонена', tone: 'danger' },
  expired: { label: 'Время истекло', tone: 'neutral' },
}

const BOOKING: Record<BookingState, Entry> = {
  confirmed: { label: 'Бронь подтверждена', tone: 'success' },
  canceled: { label: 'Отменена', tone: 'neutral' },
  completed: { label: 'Проведено', tone: 'success' },
}

const CANCELLATION: Record<CancellationState, Entry> = {
  // Deliberately explicit: while a cancellation is pending the court stays
  // reserved. A bare «Ожидает» alongside a confirmed booking reads as though
  // the booking itself were uncertain.
  pending: { label: 'Запрошена отмена', tone: 'warning' },
  approved: { label: 'Отмена одобрена', tone: 'neutral' },
  rejected: { label: 'Отмена отклонена', tone: 'neutral' },
}

const PAYMENT: Record<PaymentState, Entry> = {
  unpaid: { label: 'Не оплачено', tone: 'warning' },
  partly_paid: { label: 'Оплачено частично', tone: 'warning' },
  paid: { label: 'Оплачено', tone: 'success' },
  refunded: { label: 'Возврат оформлен', tone: 'neutral' },
  credit: { label: 'Есть переплата', tone: 'neutral' },
}

const MEMBERSHIP: Record<MembershipState, Entry> = {
  pending_activation: { label: 'Ожидает активации', tone: 'warning' },
  active: { label: 'Действует', tone: 'success' },
  expired: { label: 'Истёк', tone: 'neutral' },
  frozen: { label: 'Заморожен', tone: 'neutral' },
  revoked: { label: 'Отозван', tone: 'danger' },
}

function Badge({ label, tone }: Entry) {
  return <span className={`badge badge--${tone}`}>{label}</span>
}

export function RequestBadge({ state }: { state: RequestState }) {
  return <Badge {...REQUEST[state]} />
}

export function BookingBadge({ state }: { state: BookingState }) {
  return <Badge {...BOOKING[state]} />
}

export function CancellationBadge({ state }: { state: CancellationState }) {
  return <Badge {...CANCELLATION[state]} />
}

export function PaymentBadge({ state }: { state: PaymentState }) {
  return <Badge {...PAYMENT[state]} />
}

export function MembershipBadge({ state }: { state: MembershipState }) {
  return <Badge {...MEMBERSHIP[state]} />
}
