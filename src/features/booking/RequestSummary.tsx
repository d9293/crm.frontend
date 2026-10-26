/**
 * P07 step B — review the request. `ui-ux.md` section 5.
 *
 * The wording here is the specification's, not a paraphrase. Two phrases carry
 * real weight:
 *
 *  - «Отправьте заявку. Мы удержим время на 5 минут, пока сотрудник её
 *    рассматривает» — the customer must understand this is a *request*, not a
 *    confirmed booking.
 *  - No «Оплатить сейчас». BR-06 separates reservation and financial state, so
 *    nothing here may imply payment is required to reserve.
 *
 * The submit button is disabled while in flight and the label says so, because
 * a double submit is the main cause of duplicate requests. The idempotency key
 * is the real protection; this is the cheap one.
 */

import type { PriceSnapshot } from '../../api/types'
import { formatDate, formatInterval, formatMoney } from '../../lib/format'
import './booking.css'

interface RequestSummaryProps {
  resourceName: string
  startsAt: string
  endsAt: string
  price: PriceSnapshot | null
  submitting: boolean
  onSubmit: () => void
  disabledReason?: string
}

export function RequestSummary({
  resourceName,
  startsAt,
  endsAt,
  price,
  submitting,
  onSubmit,
  disabledReason,
}: RequestSummaryProps) {
  return (
    <aside className="crm-panel booking__summary" aria-label="Ваша заявка">
      <h2 style={{ fontSize: 'var(--crm-font-size-label)' }}>Ваша заявка</h2>

      <div className="booking__summary-row">
        <span className="crm-muted">Корт</span>
        <strong>{resourceName}</strong>
      </div>

      <div className="booking__summary-row">
        <span className="crm-muted">Дата</span>
        <strong>{formatDate(startsAt)}</strong>
      </div>

      <div className="booking__summary-row">
        <span className="crm-muted">Время</span>
        {/* formatInterval names the next date when the booking ends at
            midnight, so a 23:00-00:00 slot is not silently misread. */}
        <strong className="crm-numeric">{formatInterval(startsAt, endsAt)}</strong>
      </div>

      {price && (
        <>
          {price.lines.map((line, index) => (
            <div className="booking__summary-row" key={index}>
              <span className="crm-muted">{line.label}</span>
              <span className="crm-numeric">
                {formatMoney(line.amount_minor_units)}
              </span>
            </div>
          ))}

          <div className="booking__summary-total">
            <span>Итого</span>
            <span className="crm-numeric">{formatMoney(price.total_minor_units)}</span>
          </div>
        </>
      )}

      <p className="crm-meta">
        Отправьте заявку. Мы удержим время на 5 минут, пока сотрудник её
        рассматривает.
      </p>

      <div className="booking__actions">
        <button
          type="button"
          className="shell__control shell__control--primary"
          onClick={onSubmit}
          disabled={submitting || Boolean(disabledReason)}
        >
          {submitting ? 'Отправляем…' : 'Отправить заявку'}
        </button>

        {disabledReason && <p className="field__error">{disabledReason}</p>}

        {/* Stated explicitly: the demo's booking form led with payment
            method, which trains staff and customers to expect a payment wall
            that the agreed rules do not have. */}
        <p className="crm-meta">Оплата не требуется для подтверждения брони.</p>
      </div>
    </aside>
  )
}
