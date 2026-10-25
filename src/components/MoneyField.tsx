/**
 * MoneyField — `ui-ux.md` section 9.
 *
 * Tenge input that reports integer minor units. Three constraints:
 *
 *  - The value handed to the caller is always integer minor units. Parsing is
 *    string-based (`lib/money.ts`), never `parseFloat` followed by `* 100`.
 *  - A paid composition is locked. `README.md` section 6 and BE-10 require
 *    financial fields of a paid record to be immutable; amendment uses an
 *    explicit correction flow, so `disabled` here is a real business state,
 *    not styling.
 *  - The server total is authoritative and displayed separately. This field
 *    never computes a total the user will act on.
 */

import { useId, useState } from 'react'
import { formatMoney, type MinorUnits } from '../lib/format'
import { parseTengeToMinorUnits, toEditableTenge } from '../lib/money'
import './components.css'

interface MoneyFieldProps {
  label: string
  /** Current value in integer minor units, or null when empty. */
  value: MinorUnits | null
  onChange: (minorUnits: MinorUnits | null) => void
  /** Locked because the record is paid, or the user lacks permission. */
  disabled?: boolean
  /** Server-side field error for this input. */
  error?: string
  /** Shown beneath the field, e.g. the amount currently due. */
  hint?: string
  required?: boolean
}

export function MoneyField({
  label,
  value,
  onChange,
  disabled = false,
  error,
  hint,
  required = false,
}: MoneyFieldProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`

  // Local text so a partially typed value such as «1 200,» is not destroyed by
  // reformatting on every keystroke.
  const [text, setText] = useState(() => toEditableTenge(value))
  const [localError, setLocalError] = useState<string | null>(null)

  function handleChange(next: string) {
    setText(next)

    const parsed = parseTengeToMinorUnits(next)
    if (parsed === undefined) {
      setLocalError('Введите сумму в тенге, не более двух знаков после запятой.')
      return
    }

    setLocalError(null)
    onChange(parsed)
  }

  const shownError = error ?? localError
  const describedBy = [shownError ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      <div className="field__row">
        <input
          id={inputId}
          className="field__input crm-numeric"
          // `inputMode` gives a numeric keypad without `type="number"`, whose
          // scroll-wheel stepping and locale-dependent decimal handling are
          // both hazards on a money input.
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          required={required}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => handleChange(event.target.value)}
        />
        <span className="field__suffix" aria-hidden="true">
          ₸
        </span>
      </div>

      {disabled && (
        <p className="field__hint">
          Сумма закрыта для изменений. Используйте оформление корректировки.
        </p>
      )}

      {hint && !disabled && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}

      {shownError && (
        <p className="field__error" id={errorId}>
          {shownError}
        </p>
      )}

      {value !== null && !shownError && (
        <p className="field__hint crm-numeric">{formatMoney(value)}</p>
      )}
    </div>
  )
}
