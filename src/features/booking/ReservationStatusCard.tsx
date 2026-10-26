/**
 * P07 steps C and D, and the P08 detail — `ui-ux.md` sections 5 and 8.
 *
 * One card covering every outcome of the journey: pending with a live hold,
 * confirmed, rejected, expired, cancelled. Written as a single component
 * because the states must stay visually and verbally consistent — a customer
 * who sees a different layout per outcome has to re-learn the screen each
 * time.
 *
 * The rules it carries:
 *
 *  - **Confirmed and unpaid are separate badges.** BR-06 keeps them apart, and
 *    UX-04 requires the combination to be legible rather than collapsed.
 *  - **The countdown is informational.** `HoldTimer` derives it from
 *    `server_time`; reaching zero triggers a refresh, never an outcome.
 *  - **Expired says what happened and offers a way forward**, rather than
 *    presenting a dead request as still actionable.
 *  - No invented contact number and no promise that an employee will respond.
 */

import type { Reservation } from '../../api/types'
import { HoldTimer } from '../../components/HoldTimer'
import { PaymentBadge, ReservationBadge } from '../../components/StatusBadge'
import { InlineAlert } from '../../components/InlineAlert'
import { formatDate, formatInterval, formatMoney, formatTime } from '../../lib/format'
import './booking.css'

interface ReservationStatusCardProps {
  reservation: Reservation
  /** Called when the local countdown reaches zero, or the user asks. */
  onRefresh?: () => void
  /** Returns the customer to slot selection. */
  onChooseAnother?: () => void
  /** Opens the cancellation-request flow. Rendered only when the server allows it. */
  onRequestCancellation?: () => void
  offline?: boolean
}

export function ReservationStatusCard({
  reservation,
  onRefresh,
  onChooseAnother,
  onRequestCancellation,
  offline = false,
}: ReservationStatusCardProps) {
  const courts = reservation.allocations.map((allocation) => allocation.resource_name).join(', ')
  const outstanding = reservation.financial_summary?.outstanding_minor_units ?? 0

  return (
    <div className="crm-panel status-card">
      <div className="status-card__badges">
        <ReservationBadge state={reservation.state} />

        {/* Shown only when finance data exists. A confirmed booking with an
            unpaid balance is a normal, expected combination. */}
        {reservation.state === 'confirmed' && reservation.financial_summary && (
          <PaymentBadge state={outstanding > 0 ? 'unpaid' : 'paid'} />
        )}

        {reservation.cancellation_request_state === 'pending' && (
          <span className="badge badge--warning">Запрошена отмена</span>
        )}
      </div>

      <dl className="status-card__facts">
        <div className="status-card__fact">
          <dt>Корт</dt>
          <dd>{courts}</dd>
        </div>
        <div className="status-card__fact">
          <dt>Дата</dt>
          <dd>{formatDate(reservation.starts_at)}</dd>
        </div>
        <div className="status-card__fact">
          <dt>Время</dt>
          <dd className="crm-numeric">
            {formatInterval(reservation.starts_at, reservation.ends_at)}
          </dd>
        </div>
        {reservation.price_snapshot && (
          <div className="status-card__fact">
            <dt>Стоимость</dt>
            <dd className="crm-numeric">
              {formatMoney(reservation.price_snapshot.total_minor_units)}
            </dd>
          </div>
        )}
      </dl>

      {reservation.state === 'pending_confirmation' && reservation.hold_expires_at && (
        <>
          <HoldTimer
            expiresAt={reservation.hold_expires_at}
            serverTime={reservation.server_time}
            onExpiryReached={onRefresh}
            offline={offline}
          />
          <p className="crm-meta">
            Если сотрудник не подтвердит заявку, время снова станет доступно.
          </p>
          {onRefresh && (
            <button type="button" className="shell__control" onClick={onRefresh}>
              Обновить статус
            </button>
          )}
        </>
      )}

      {reservation.state === 'confirmed' && (
        <>
          <InlineAlert tone="info" title="Бронь подтверждена">
            {outstanding > 0
              ? `Оплатить можно позже. К оплате ${formatMoney(outstanding)}.`
              : 'Корт зарезервирован за вами.'}
          </InlineAlert>

          {/* A pending cancellation does NOT change the booking: it stays
              confirmed and keeps the court. Saying so plainly prevents the
              customer assuming the slot is already released (BR-08). */}
          {reservation.cancellation_request_state === 'pending' && (
            <InlineAlert tone="warning" title="Запрос на отмену отправлен">
              Бронь останется действующей, пока администратор не одобрит
              отмену. Отмена брони не оформляет возврат автоматически.
            </InlineAlert>
          )}

          {/* The action appears only while the server says it may. The exact
              deadline comes from the server too — UX-03 requires the customer
              to be able to identify it, and a client computing it would be
              wrong whenever its clock is off. */}
          {reservation.can_request_cancellation && onRequestCancellation && (
            <>
              {reservation.cancellation_cutoff_at && (
                <p className="crm-meta">
                  Отмену можно запросить до{' '}
                  <span className="crm-numeric">
                    {formatTime(reservation.cancellation_cutoff_at)}
                  </span>
                  , {formatDate(reservation.cancellation_cutoff_at)}.
                </p>
              )}
              <button type="button" className="shell__control" onClick={onRequestCancellation}>
                Запросить отмену
              </button>
            </>
          )}

          {/* Past the deadline with no request open: explain, and promise
              nothing. No invented phone number, no hint of an override. */}
          {!reservation.can_request_cancellation &&
            reservation.cancellation_request_state === null &&
            reservation.cancellation_cutoff_at && (
              <p className="crm-meta">
                Срок самостоятельной отмены истёк — её можно было запросить до{' '}
                <span className="crm-numeric">
                  {formatTime(reservation.cancellation_cutoff_at)}
                </span>
                , {formatDate(reservation.cancellation_cutoff_at)}.
              </p>
            )}
        </>
      )}

      {reservation.state === 'rejected' && (
        <>
          <InlineAlert tone="warning" title="Заявка отклонена">
            {/* Only a reason the server marked safe to disclose reaches here. */}
            {reservation.decision_reason ?? 'Сотрудник не подтвердил заявку.'}
          </InlineAlert>
          {onChooseAnother && (
            <button type="button" className="shell__control" onClick={onChooseAnother}>
              Выбрать другое время
            </button>
          )}
        </>
      )}

      {reservation.state === 'expired' && (
        <>
          <InlineAlert tone="warning" title="Время ожидания истекло">
            Бронь не подтверждена. Время снова доступно для бронирования.
          </InlineAlert>
          {onChooseAnother && (
            <button type="button" className="shell__control" onClick={onChooseAnother}>
              Посмотреть свободное время
            </button>
          )}
        </>
      )}

      {reservation.state === 'canceled' && (
        <InlineAlert tone="info" title="Бронь отменена">
          Отмена брони не оформляет возврат автоматически.
        </InlineAlert>
      )}
    </div>
  )
}
