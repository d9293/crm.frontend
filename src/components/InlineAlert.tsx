/**
 * InlineAlert — `ui-ux.md` section 9.
 *
 * Message, recovery action and an optional correlation reference. Variants
 * include the uncertain-transaction case, which is the one that matters most:
 * `ui-ux.md` section 10 requires «Проверяем результат операции» plus a lookup
 * or retry with the same command key — never an invitation to pay again.
 */

import type { ReactNode } from 'react'
import './components.css'

export type AlertTone = 'info' | 'warning' | 'error' | 'uncertain'

interface InlineAlertProps {
  tone: AlertTone
  title?: string
  children: ReactNode
  /** Primary recovery affordance, e.g. retry or look up the outcome. */
  action?: { label: string; onClick: () => void }
  /** `correlation_id` from the error body, safe to show for support. */
  correlationId?: string
}

const ROLE: Record<AlertTone, 'status' | 'alert'> = {
  info: 'status',
  warning: 'status',
  // Errors and uncertain outcomes interrupt; informational states do not.
  error: 'alert',
  uncertain: 'alert',
}

export function InlineAlert({
  tone,
  title,
  children,
  action,
  correlationId,
}: InlineAlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={ROLE[tone]}>
      {title && <strong className="alert__title">{title}</strong>}
      <div className="alert__body">{children}</div>

      {action && (
        <button type="button" className="shell__control" onClick={action.onClick}>
          {action.label}
        </button>
      )}

      {correlationId && (
        <p className="alert__reference crm-meta">
          Код обращения: <span className="crm-numeric">{correlationId}</span>
        </p>
      )}
    </div>
  )
}

/**
 * The uncertain-outcome alert for a financial or booking command whose
 * response was lost.
 *
 * `onRecover` must re-send the ORIGINAL command with the same idempotency key,
 * or look the operation up. It must never start a new one — that is how a
 * single payment becomes two.
 */
export function UncertainOutcomeAlert({
  onRecover,
  correlationId,
}: {
  onRecover: () => void
  correlationId?: string
}) {
  return (
    <InlineAlert
      tone="uncertain"
      title="Проверяем результат операции"
      action={{ label: 'Проверить результат', onClick: onRecover }}
      correlationId={correlationId}
    >
      Ответ сервера не получен. Операция могла быть выполнена. Не создавайте
      новую — сначала проверьте результат предыдущей.
    </InlineAlert>
  )
}
