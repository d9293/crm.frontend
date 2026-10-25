/**
 * Money parsing.
 *
 * Separate from the `MoneyField` component so neither file mixes component and
 * non-component exports, and so the parser can be used by any form without
 * pulling in a React component.
 */

import type { MinorUnits } from './format'

/**
 * Parses a tenge string into integer minor units without floating point.
 *
 * Accepts a comma or dot separator, spaces as thousands grouping, and at most
 * two fractional digits.
 *
 * Returns `null` for empty input and `undefined` for malformed input, so a
 * caller can distinguish "the user cleared the field" from "the user typed
 * something unusable" — those need different handling and a single `null`
 * would conflate them.
 *
 * The digits are assembled as a string and converted once. `parseFloat('0.07')
 * * 100` is 7.000000000000001, and rounding that away is exactly the class of
 * error the integer-minor-units convention exists to prevent.
 */
export function parseTengeToMinorUnits(raw: string): MinorUnits | null | undefined {
  const cleaned = raw.replace(/[\s ]/g, '').replace(',', '.')
  if (cleaned === '') return null

  const match = /^(-?)(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned)
  if (!match) return undefined

  const [, sign, whole, fraction = ''] = match
  if (whole === '' && fraction === '') return undefined

  const minor = fraction.padEnd(2, '0')
  const magnitude = Number(`${whole || '0'}${minor}`)
  if (!Number.isSafeInteger(magnitude)) return undefined

  return sign === '-' ? -magnitude : magnitude
}

/** Renders minor units for editing, without a currency symbol. */
export function toEditableTenge(minorUnits: MinorUnits | null): string {
  if (minorUnits === null) return ''

  const negative = minorUnits < 0
  const absolute = Math.abs(minorUnits)
  const whole = Math.floor(absolute / 100)
  const fraction = absolute % 100

  const body =
    fraction === 0 ? String(whole) : `${whole},${String(fraction).padStart(2, '0')}`

  return negative ? `-${body}` : body
}
