/**
 * P10 approval queue — `ui-ux.md` sections 6 and 8, template T4.
 *
 * List at ~40% with the detail at ~60%, sorted by nearest expiry. The rules
 * that matter:
 *
 *  - **Sorted by urgency, but focus is not stolen.** The server returns the
 *    order; this component does not re-sort on a timer, because section 6
 *    forbids reordering keyboard focus when expiry changes the order.
 *  - **Decision buttons disappear at server expiry.** `can_confirm` and
 *    `can_reject` come from the server, so an expired row loses its actions
 *    even if the browser clock disagrees.
 *  - **No optimistic success.** The list and detail update only from a
 *    committed response.
 *  - **Confirmation does not ask for payment.** The detail shows the balance
 *    for information; confirming is independent of it.
 */

import type { Reservation } from '../../api/types'
import { HoldTimer } from '../../components/HoldTimer'
import { PaymentBadge, ReservationBadge } from '../../components/StatusBadge'
import { InlineAlert } from '../../components/InlineAlert'
import { formatDate, formatInterval, formatMoney, formatTime } from '../../lib/format'
import './booking.css'

interface ApprovalQueueProps {
  requests: Reservation[]
  serverTime: string
  selectedId: number | null
  onSelect: (id: number) => void
  onConfirm: (reservation: Reservation) => void
  onReject: (reservation: Reservation) => void
  submitting: boolean
  /** Conflict or denial from the last decision attempt. */
  notice?: { title: string; message: string } | null
  onRefresh?: () => void
}

export function ApprovalQueue({
  requests,
  serverTime,
  selectedId,
  onSelect,
  onConfirm,
  onReject,
  submitting,
  notice,
  onRefresh,
}: ApprovalQueueProps) {
  const selected = requests.find((request) => request.id === selectedId) ?? requests[0] ?? null

  return (
    <div>
      <div className="booking__toolbar">
        <div>
          <strong>Активных заявок: </strong>
          <span className="crm-numeric">
            {requests.filter((request) => request.state === 'pending_confirmation').length}
          </span>
          {/* Last-update time, so an employee can tell whether they are
              looking at fresh data before deciding. */}
          <span className="crm-meta"> · обновлено {formatTime(serverTime)}</span>
        </div>
        {onRefresh && (
          <button type="button" className="shell__control" onClick={onRefresh}>
            Обновить
          </button>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="crm-panel queue__empty">
          <p className="crm-muted">Заявок, ожидающих решения, нет.</p>
        </div>
      ) : (
        <div className="queue">
          <div className="queue__list" role="list">
            {requests.map((request) => (
              <button
                type="button"
                role="listitem"
                key={request.id}
                className="queue__row"
                aria-current={request.id === selected?.id}
                onClick={() => onSelect(request.id)}
              >
                <span className="queue__row-top">
                  <ReservationBadge state={request.state} />
                  {request.state === 'pending_confirmation' && request.hold_expires_at && (
                    <span className="crm-meta crm-numeric">
                      до {formatTime(request.hold_expires_at)}
                    </span>
                  )}
                </span>
                <span className="queue__row-when crm-numeric">
                  {formatInterval(request.starts_at, request.ends_at)} ·{' '}
                  {request.allocations.map((a) => a.resource_name).join(', ')}
                </span>
                {/* Authorized staff only; the API omits it otherwise. */}
                {request.customer_display_name && (
                  <span className="crm-meta">{request.customer_display_name}</span>
                )}
              </button>
            ))}
          </div>

          {selected && (
            <div className="crm-panel status-card">
              <div className="status-card__badges">
                <ReservationBadge state={selected.state} />
                {selected.financial_summary && (
                  <PaymentBadge
                    state={
                      selected.financial_summary.outstanding_minor_units > 0 ? 'unpaid' : 'paid'
                    }
                  />
                )}
              </div>

              {selected.state === 'pending_confirmation' && selected.hold_expires_at && (
                <HoldTimer
                  expiresAt={selected.hold_expires_at}
                  serverTime={selected.server_time}
                  onExpiryReached={onRefresh}
                />
              )}

              <dl className="status-card__facts">
                <div className="status-card__fact">
                  <dt>Корт</dt>
                  <dd>{selected.allocations.map((a) => a.resource_name).join(', ')}</dd>
                </div>
                <div className="status-card__fact">
                  <dt>Дата</dt>
                  <dd>{formatDate(selected.starts_at)}</dd>
                </div>
                <div className="status-card__fact">
                  <dt>Время</dt>
                  <dd className="crm-numeric">
                    {formatInterval(selected.starts_at, selected.ends_at)}
                  </dd>
                </div>
                {selected.customer_display_name && (
                  <div className="status-card__fact">
                    <dt>Клиент</dt>
                    <dd>{selected.customer_display_name}</dd>
                  </div>
                )}
                <div className="status-card__fact">
                  <dt>Заявка создана</dt>
                  <dd className="crm-numeric">{formatTime(selected.requested_at)}</dd>
                </div>
                {selected.price_snapshot && (
                  <div className="status-card__fact">
                    <dt>Стоимость</dt>
                    <dd className="crm-numeric">
                      {formatMoney(selected.price_snapshot.total_minor_units)}
                    </dd>
                  </div>
                )}
              </dl>

              {notice && (
                <InlineAlert tone="warning" title={notice.title}>
                  {notice.message}
                </InlineAlert>
              )}

              {/* Actions appear only while the server says a decision is
                  possible. An expired request shows an explanation instead. */}
              {selected.can_confirm || selected.can_reject ? (
                <div className="dialog__actions">
                  <button
                    type="button"
                    className="shell__control"
                    disabled={submitting || !selected.can_reject}
                    onClick={() => onReject(selected)}
                  >
                    Отклонить
                  </button>
                  <button
                    type="button"
                    className="shell__control shell__control--primary"
                    disabled={submitting || !selected.can_confirm}
                    onClick={() => onConfirm(selected)}
                  >
                    {submitting ? 'Выполняется…' : 'Подтвердить бронь'}
                  </button>
                </div>
              ) : (
                <InlineAlert tone="info" title={decisionUnavailableTitle(selected)}>
                  {decisionUnavailableBody(selected)}
                </InlineAlert>
              )}

              {selected.state === 'pending_confirmation' && (
                <p className="crm-meta">
                  Подтверждение не требует оплаты. Оплата учитывается отдельно.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function decisionUnavailableTitle(reservation: Reservation): string {
  switch (reservation.state) {
    case 'expired':
      return 'Заявка истекла'
    case 'confirmed':
      return 'Бронь подтверждена'
    case 'rejected':
      return 'Заявка отклонена'
    case 'canceled':
      return 'Бронь отменена'
    default:
      return 'Решение недоступно'
  }
}

function decisionUnavailableBody(reservation: Reservation): string {
  switch (reservation.state) {
    case 'expired':
      return 'Время удержания истекло, время снова доступно для бронирования.'
    case 'confirmed':
    case 'rejected':
      return reservation.decided_at
        ? `Решение принято в ${formatTime(reservation.decided_at)}.`
        : 'Решение уже принято.'
    default:
      return 'Для этой записи решение больше не требуется.'
  }
}
