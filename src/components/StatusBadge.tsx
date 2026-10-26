/**
 * StatusBadge — `ui-ux.md` section 9.
 *
 * Explicit enum-to-label mapping with a semantic tone. Two rules:
 *
 *  - Status must never be conveyed by colour alone, so the label text is
 *    always rendered. The tone is reinforcement, not the message.
 *  - Reservation, cancellation, payment and membership states are **separate
 *    vocabularies** with their own badges. Collapsing them would let
 *    «Подтверждена» (reservation) and «Оплачено» (payment) occupy one column,
 *    and `README.md` section 6 is explicit that paid/unpaid is never a
 *    reservation state.
 *
 * A confirmed-but-unpaid booking therefore renders two badges, and a confirmed
 * booking with a pending cancellation renders two more — the distinct
 * combinations UX-04 requires.
 *
 * Reservation and cancellation states are typed from the generated contract,
 * not redeclared here. `satisfies Record<ReservationState, Entry>` makes a new
 * state in the contract a compile error rather than a silently unlabelled
 * badge.
 */

import type { CancellationState, ReservationState } from '../api/types'
import './components.css'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

/** Financial state, independent of any reservation state. */
export type PaymentState = 'unpaid' | 'partly_paid' | 'paid' | 'refunded' | 'credit'

export type MembershipState =
  | 'pending_activation'
  | 'active'
  | 'expired'
  | 'frozen'
  | 'revoked'

interface Entry {
  label: string
  tone: BadgeTone
}

const RESERVATION = {
  pending_confirmation: { label: 'Ожидает подтверждения', tone: 'warning' },
  confirmed: { label: 'Бронь подтверждена', tone: 'success' },
  rejected: { label: 'Заявка отклонена', tone: 'danger' },
  // Neutral rather than danger: an expired hold is an ordinary outcome of
  // nobody acting, not a failure the customer caused.
  expired: { label: 'Время ожидания истекло', tone: 'neutral' },
  canceled: { label: 'Отменена', tone: 'neutral' },
} as const satisfies Record<ReservationState, Entry>

const CANCELLATION = {
  // Deliberately explicit: while a cancellation is pending the court stays
  // reserved. A bare «Ожидает» next to a confirmed booking would read as
  // though the booking itself were uncertain.
  pending: { label: 'Запрошена отмена', tone: 'warning' },
  approved: { label: 'Отмена одобрена', tone: 'neutral' },
  rejected: { label: 'Отмена отклонена', tone: 'neutral' },
} as const satisfies Record<CancellationState, Entry>

const PAYMENT = {
  unpaid: { label: 'Не оплачено', tone: 'warning' },
  partly_paid: { label: 'Оплачено частично', tone: 'warning' },
  paid: { label: 'Оплачено', tone: 'success' },
  refunded: { label: 'Возврат оформлен', tone: 'neutral' },
  credit: { label: 'Есть переплата', tone: 'neutral' },
} as const satisfies Record<PaymentState, Entry>

const MEMBERSHIP = {
  pending_activation: { label: 'Ожидает активации', tone: 'warning' },
  active: { label: 'Действует', tone: 'success' },
  expired: { label: 'Истёк', tone: 'neutral' },
  frozen: { label: 'Заморожен', tone: 'neutral' },
  revoked: { label: 'Отозван', tone: 'danger' },
} as const satisfies Record<MembershipState, Entry>

function Badge({ label, tone }: Entry) {
  return <span className={`badge badge--${tone}`}>{label}</span>
}

export function ReservationBadge({ state }: { state: ReservationState }) {
  return <Badge {...RESERVATION[state]} />
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
