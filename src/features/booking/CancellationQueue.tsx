/**
 * P11 cancellation decision queue — `ui-ux.md` sections 7 and 8, template T4.
 *
 * Structurally like the P10 approval queue, with three deliberate differences:
 *
 *  - **No countdown.** A cancellation request has no expiry of its own, and
 *    `README.md` section 6 forbids inventing a second timeout. Rows are
 *    ordered by how soon the *booking* starts, which is the real urgency.
 *  - **The original booking is the context.** The administrator decides about
 *    a reservation, so its court, time and payment state are shown — payment
 *    only where the actor may see it.
 *  - **Approval states that the slot is released and that money is not
 *    refunded.** BR-09 makes those independent, and `ui-ux.md` section 7
 *    forbids an implicit refund checkbox here.
 */

import type { CancellationRequest } from '../../api/types'
import { CancellationBadge, ReservationBadge } from '../../components/StatusBadge'
import { InlineAlert } from '../../components/InlineAlert'
import { formatDate, formatInterval, formatTime } from '../../lib/format'
import './booking.css'

interface CancellationQueueProps {
  requests: CancellationRequest[]
  serverTime: string
  selectedId: number | null
  onSelect: (id: number) => void
  onApprove: (request: CancellationRequest) => void
  onReject: (request: CancellationRequest) => void
  submitting: boolean
  notice?: { title: string; message: string } | null
  onRefresh?: () => void
}

export function CancellationQueue({
  requests,
  serverTime,
  selectedId,
  onSelect,
  onApprove,
  onReject,
  submitting,
  notice,
  onRefresh,
}: CancellationQueueProps) {
  const selected = requests.find((request) => request.id === selectedId) ?? requests[0] ?? null
  const pendingCount = requests.filter((request) => request.state === 'pending').length

  return (
    <div>
      <div className="booking__toolbar">
        <div>
          <strong>Запросов на отмену: </strong>
          <span className="crm-numeric">{pendingCount}</span>
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
          <p className="crm-muted">Запросов на отмену нет.</p>
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
                  <CancellationBadge state={request.state} />
                </span>
                <span className="queue__row-when crm-numeric">
                  {request.reservation
                    ? `${formatInterval(
                        request.reservation.starts_at,
                        request.reservation.ends_at,
                      )} · ${request.reservation.allocations
                        .map((allocation) => allocation.resource_name)
                        .join(', ')}`
                    : formatDate(request.reservation_starts_at)}
                </span>
                {request.customer_display_name && (
                  <span className="crm-meta">{request.customer_display_name}</span>
                )}
              </button>
            ))}
          </div>

          {selected && (
            <div className="crm-panel status-card">
              <div className="status-card__badges">
                <CancellationBadge state={selected.state} />
                {/* The booking's own state sits alongside: while the request
                    is pending the reservation is still confirmed. */}
                {selected.reservation && (
                  <ReservationBadge state={selected.reservation.state} />
                )}
              </div>

              <dl className="status-card__facts">
                {selected.reservation && (
                  <>
                    <div className="status-card__fact">
                      <dt>Корт</dt>
                      <dd>
                        {selected.reservation.allocations
                          .map((allocation) => allocation.resource_name)
                          .join(', ')}
                      </dd>
                    </div>
                    <div className="status-card__fact">
                      <dt>Время брони</dt>
                      <dd className="crm-numeric">
                        {formatInterval(
                          selected.reservation.starts_at,
                          selected.reservation.ends_at,
                        )}
                      </dd>
                    </div>
                  </>
                )}
                <div className="status-card__fact">
                  <dt>Дата брони</dt>
                  <dd>{formatDate(selected.reservation_starts_at)}</dd>
                </div>
                <div className="status-card__fact">
                  <dt>Запрос создан</dt>
                  <dd className="crm-numeric">{formatTime(selected.requested_at)}</dd>
                </div>
                <div className="status-card__fact">
                  <dt>Срок самостоятельной отмены</dt>
                  <dd className="crm-numeric">
                    {formatTime(selected.cancellation_cutoff_at)}
                  </dd>
                </div>
                {selected.customer_display_name && (
                  <div className="status-card__fact">
                    <dt>Клиент</dt>
                    <dd>{selected.customer_display_name}</dd>
                  </div>
                )}
                {selected.reason && (
                  <div className="status-card__fact">
                    <dt>Причина</dt>
                    <dd>{selected.reason}</dd>
                  </div>
                )}
              </dl>

              {notice && (
                <InlineAlert tone="warning" title={notice.title}>
                  {notice.message}
                </InlineAlert>
              )}

              {selected.can_decide ? (
                <>
                  {/* Stated before the decision, not buried in a toast after
                      it: releasing the court and refunding money are separate
                      acts (BR-09). */}
                  <InlineAlert tone="info" title="Что произойдёт при одобрении">
                    Бронь будет отменена, корт освободится. Возврат денег не
                    оформляется автоматически.
                  </InlineAlert>

                  <div className="dialog__actions">
                    <button
                      type="button"
                      className="shell__control"
                      disabled={submitting}
                      onClick={() => onReject(selected)}
                    >
                      Отклонить запрос
                    </button>
                    <button
                      type="button"
                      className="shell__control shell__control--primary"
                      disabled={submitting}
                      onClick={() => onApprove(selected)}
                    >
                      {submitting ? 'Выполняется…' : 'Одобрить отмену'}
                    </button>
                  </div>
                </>
              ) : (
                <InlineAlert tone="info" title={decidedTitle(selected)}>
                  {decidedBody(selected)}
                </InlineAlert>
              )}

              {selected.reservation?.state === 'confirmed' && selected.state === 'pending' && (
                <p className="crm-meta">
                  До решения бронь остаётся действующей и корт занят.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function decidedTitle(request: CancellationRequest): string {
  switch (request.state) {
    case 'approved':
      return 'Отмена одобрена'
    case 'rejected':
      return 'Запрос отклонён'
    default:
      return 'Решение недоступно'
  }
}

function decidedBody(request: CancellationRequest): string {
  const when = request.decided_at ? ` в ${formatTime(request.decided_at)}` : ''

  switch (request.state) {
    case 'approved':
      return `Бронь отменена${when}, корт освобождён. Возврат денег оформляется отдельно.`
    case 'rejected':
      return `Запрос отклонён${when}. Бронь осталась действующей.`
    default:
      return 'Для этого запроса решение не требуется.'
  }
}
