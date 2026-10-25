/**
 * Money and date/time formatting.
 *
 * Two rules from `development/README.md` section 6 drive everything here:
 *
 *  - Monetary API values are integer minor units with currency KZT. Display is
 *    in tenge. Never use a float for money.
 *  - `Asia/Almaty` is the business timezone for display, report boundaries and
 *    recurrence expansion — not the workstation timezone. A user travelling, or
 *    a laptop with the wrong zone, must still see club-local times.
 */

/**
 * Business timezone.
 *
 * `Asia/Almaty` is currently **UTC+5**. Kazakhstan unified its timezones on
 * 1 March 2024, moving Almaty from UTC+6 to UTC+5. Historical instants before
 * that date are still +06, which is precisely why the zone name is used
 * everywhere and a fixed offset never is: anything hand-written as `+06:00`
 * is an hour wrong today, and anything hand-written as `+05:00` is an hour
 * wrong for 2023 data.
 *
 * Always pass this identifier to `Intl`. Never compute an offset.
 */
export const BUSINESS_TIMEZONE = 'Asia/Almaty'
export const LOCALE = 'ru-KZ'

/** Minor units per tenge. KZT is a two-decimal currency in ISO 4217. */
const MINOR_UNITS_PER_TENGE = 100

/**
 * Integer minor units as received from the API. Named so a plain `number`
 * holding tenge cannot be passed by accident.
 */
export type MinorUnits = number

/**
 * Formats minor units as tenge.
 *
 * Fractional digits appear only when the amount actually has them: prices here
 * are whole tenge in practice, and rendering «15 000,00 ₸» on every row is
 * noise. A non-zero remainder is always shown rather than rounded away —
 * silently hiding 50 tiyn from a balance would be a reconciliation bug.
 */
export function formatMoney(
  minorUnits: MinorUnits,
  options: { signDisplay?: 'auto' | 'always' | 'never' } = {},
): string {
  assertInteger(minorUnits, 'formatMoney')

  const hasFraction = minorUnits % MINOR_UNITS_PER_TENGE !== 0

  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
    signDisplay: options.signDisplay ?? 'auto',
  }).format(minorUnits / MINOR_UNITS_PER_TENGE)
}

/**
 * Formats a refund or reversal. `ui-ux.md` section 8 requires negative and
 * refund amounts to be labelled, not distinguished by colour alone, so the
 * sign is always rendered.
 */
export function formatMoneySigned(minorUnits: MinorUnits): string {
  return formatMoney(minorUnits, { signDisplay: 'always' })
}

function assertInteger(value: number, caller: string): void {
  if (!Number.isInteger(value)) {
    // Loud rather than silent: a non-integer here means a float crept into a
    // money path somewhere upstream, which is exactly the defect the
    // minor-units convention exists to prevent.
    throw new TypeError(
      `${caller}: expected integer minor units, received ${value}. ` +
        'Money must never be represented as a fractional number.',
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Dates and times                                                            */
/* -------------------------------------------------------------------------- */

/** ISO 8601 instant with offset, as carried by the API. */
export type Instant = string

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BUSINESS_TIMEZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BUSINESS_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BUSINESS_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BUSINESS_TIMEZONE,
  weekday: 'long',
})

/** «25 октября 2026 г.» */
export function formatDate(instant: Instant): string {
  return dateFormatter.format(new Date(instant))
}

/** «25.10.2026» — for dense tables. */
export function formatDateShort(instant: Instant): string {
  return shortDateFormatter.format(new Date(instant))
}

/** «14:05» in club-local time, 24-hour. */
export function formatTime(instant: Instant): string {
  return timeFormatter.format(new Date(instant))
}

export function formatWeekday(instant: Instant): string {
  return weekdayFormatter.format(new Date(instant))
}

export function formatDateTime(instant: Instant): string {
  return `${formatDate(instant)}, ${formatTime(instant)}`
}

/**
 * Formats a booking interval.
 *
 * The midnight case is the reason this is a function and not string
 * concatenation at each call site. Courts run 07:00–00:00, and a 00:00 end
 * belongs to the next calendar date (BR-12). A naive renderer shows
 * «23:00–00:00» with one date and loses the fact that the session ends the
 * following day; AC-07 tests exactly this.
 */
export function formatInterval(startsAt: Instant, endsAt: Instant): string {
  const start = formatTime(startsAt)
  const end = formatTime(endsAt)

  if (isSameBusinessDay(startsAt, endsAt)) {
    return `${start}–${end}`
  }

  return `${start}–${end} (${formatDateShort(endsAt)})`
}

/**
 * Calendar-date key in the business timezone, `YYYY-MM-DD`.
 *
 * Built from `Intl` parts rather than `toISOString().slice(0, 10)`, which
 * would answer in UTC: at 01:00 Almaty the UTC date is still the previous day,
 * so a UTC-derived key puts early-morning bookings on the wrong date.
 */
export function businessDateKey(instant: Instant): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant))

  // en-CA yields YYYY-MM-DD.
  return parts
}

export function isSameBusinessDay(a: Instant, b: Instant): boolean {
  return businessDateKey(a) === businessDateKey(b)
}

/**
 * Formats a date-only value — a birth date or tariff effective date — without
 * any timezone conversion.
 *
 * `new Date('2026-10-25')` parses as UTC midnight, which in a negative-offset
 * zone renders as the 24th. Birth dates and tariff dates must not shift
 * (README section 6), so the parts are read from the string directly.
 */
export function formatLocalDate(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate)
  if (!match) {
    throw new TypeError(`formatLocalDate: expected YYYY-MM-DD, received ${localDate}`)
  }

  const [, year, month, day] = match
  // Construct in UTC and format in UTC: no zone shift can occur.
  const asUtc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))

  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(asUtc)
}

/**
 * Remaining whole seconds until an instant, measured against a server-anchored
 * clock. Never negative.
 *
 * Takes `now` explicitly rather than reading `Date.now()`, because hold
 * countdowns must be computed from server time: a device with a skewed clock
 * must not be able to appear to extend or shorten a five-minute hold
 * (`frontend.md` FE-07). The countdown is informational either way — only the
 * server decides whether a hold is still live.
 */
export function secondsUntil(target: Instant, now: Date): number {
  const remaining = Math.floor((new Date(target).getTime() - now.getTime()) / 1000)
  return Math.max(0, remaining)
}

/** «4:59» — for a hold countdown. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
