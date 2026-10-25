/**
 * DecisionDialog — `ui-ux.md` section 9.
 *
 * A focused dialog for one consequential decision. Section 9 is explicit:
 * «never generic Are you sure alone». The dialog must state the exact
 * consequence, so `consequence` is a required prop.
 *
 * Reason policy follows the API, not a designer's assumption — section 6 warns
 * against requiring a reason because someone supposed one was needed. Hence
 * three explicit modes rather than a boolean.
 *
 * Focus management per section 11: focus enters at the heading, stays inside
 * while open, and returns to the triggering element on close. Escape closes
 * only when nothing would be lost.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import './components.css'

export type ReasonPolicy = 'none' | 'optional' | 'required'

interface DecisionDialogProps {
  open: boolean
  title: string
  /**
   * What will actually happen, in plain Russian. Not «Вы уверены?» — the user
   * needs to know the court is released, or that no refund is created.
   */
  consequence: string
  confirmLabel: string
  cancelLabel?: string
  reasonPolicy?: ReasonPolicy
  reasonLabel?: string
  /** Disables both actions while the command is in flight. */
  submitting?: boolean
  /** Rendered above the actions — e.g. a conflict or stale-version alert. */
  notice?: ReactNode
  onConfirm: (reason: string | null) => void
  onCancel: () => void
}

/**
 * Mounts the dialog body only while open.
 *
 * This is what keeps the reason field empty on each opening: a fresh mount
 * initializes its own state, rather than an effect clearing state after the
 * dialog has already rendered with the previous value.
 */
export function DecisionDialog(props: DecisionDialogProps) {
  if (!props.open) return null
  return <DecisionDialogBody {...props} />
}

function DecisionDialogBody({
  title,
  consequence,
  confirmLabel,
  cancelLabel = 'Отмена',
  reasonPolicy = 'none',
  reasonLabel = 'Причина',
  submitting = false,
  notice,
  onConfirm,
  onCancel,
}: DecisionDialogProps) {
  const headingId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [reason, setReason] = useState('')

  // Move focus in on mount and return it to the trigger on unmount.
  useEffect(() => {
    const trigger = document.activeElement
    headingRef.current?.focus()

    return () => {
      if (trigger instanceof HTMLElement) {
        trigger.focus()
      }
    }
  }, [])

  // Focus trap plus Escape. Escape is ignored while submitting: closing
  // mid-command would leave the user unsure whether it committed.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, input, [href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [submitting, onCancel])

  const reasonMissing = reasonPolicy === 'required' && reason.trim() === ''

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={dialogRef}
      >
        <h2 className="dialog__title" id={headingId} ref={headingRef} tabIndex={-1}>
          {title}
        </h2>

        <p className="dialog__consequence">{consequence}</p>

        {notice && <div className="dialog__notice">{notice}</div>}

        {reasonPolicy !== 'none' && (
          <label className="field">
            <span className="field__label">
              {reasonLabel}
              {reasonPolicy === 'optional' && (
                <span className="crm-meta"> (необязательно)</span>
              )}
            </span>
            <textarea
              className="field__input"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
            />
          </label>
        )}

        <div className="dialog__actions">
          <button
            type="button"
            className="shell__control"
            onClick={onCancel}
            disabled={submitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="shell__control shell__control--primary"
            onClick={() => onConfirm(reason.trim() === '' ? null : reason.trim())}
            disabled={submitting || reasonMissing}
          >
            {/* The action names its object. Never «Готово» for a state change. */}
            {submitting ? 'Выполняется…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
