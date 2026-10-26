/**
 * Business-timezone arithmetic.
 *
 * `format.ts` renders instants for display. This module does the inverse and
 * harder direction: turning a local calendar date and wall-clock time in the
 * club's timezone into a UTC instant. That is needed wherever the business
 * thinks in local terms but the server stores instants — opening hours,
 * day boundaries for a schedule, and recurrence expansion in S4.
 *
 * Why not `new Date('2026-10-26T07:00:00')`? That parses in the *browser's*
 * timezone, so a laptop set to UTC would place 07:00 Almaty five hours wrong.
 * `README.md` section 6 is explicit that `Asia/Almaty` governs, not the
 * workstation.
 *
 * **DST assumption:** Kazakhstan abolished daylight saving in 2005, so
 * `Asia/Almaty` has a single fixed offset within any period this system deals
 * with, and the one-pass offset correction below is exact. In a zone with DST
 * the same code can be off by an hour near a transition, and ambiguous or
 * non-existent local times would need explicit handling. If a second
 * location in a DST zone is ever added, this needs revisiting — hence the
 * assertion in the tests rather than a silent assumption.
 *
 * Note that Almaty moved from UTC+6 to UTC+5 on 1 March 2024. That is an
 * offset *change*, not DST: `Intl` knows it, which is why every conversion
 * here goes through the zone identifier and never a hardcoded number.
 */

import { BUSINESS_TIMEZONE } from './format'

/**
 * The zone's offset from UTC at a given instant, in milliseconds.
 *
 * Derived by formatting the instant in the target zone, reading the resulting
 * wall-clock fields back as though they were UTC, and taking the difference.
 */
export function zoneOffsetMs(instant: Date, timeZone: string = BUSINESS_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const field = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type)
    if (!found) throw new Error(`zoneOffsetMs: missing ${type} part`)
    return Number(found.value)
  }

  // `hour12: false` can yield hour 24 for midnight in some engines.
  const hour = field('hour') % 24

  const asIfUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    hour,
    field('minute'),
    field('second'),
  )

  return asIfUtc - instant.getTime()
}

/**
 * Converts a local date and wall-clock time in the business timezone to a UTC
 * instant.
 *
 * `localDate` is `YYYY-MM-DD`, `localTime` is `HH:MM`. Pass
 * `dayOffset: 1` for a time belonging to the following calendar date — which
 * is how a 00:00 close is expressed, per BR-12.
 */
export function businessTimeToInstant(
  localDate: string,
  localTime: string,
  options: { dayOffset?: number; timeZone?: string } = {},
): Date {
  const timeZone = options.timeZone ?? BUSINESS_TIMEZONE
  const dayOffset = options.dayOffset ?? 0

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate)
  if (!dateMatch) {
    throw new TypeError(`businessTimeToInstant: expected YYYY-MM-DD, received ${localDate}`)
  }

  const timeMatch = /^(\d{2}):(\d{2})$/.exec(localTime)
  if (!timeMatch) {
    throw new TypeError(`businessTimeToInstant: expected HH:MM, received ${localTime}`)
  }

  const [, year, month, day] = dateMatch
  const [, hour, minute] = timeMatch

  // Treat the local fields as though they were UTC, then subtract the zone's
  // actual offset at approximately that moment. Exact in a zone without DST.
  const naive = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day) + dayOffset,
    Number(hour),
    Number(minute),
  )

  const offset = zoneOffsetMs(new Date(naive), timeZone)
  return new Date(naive - offset)
}

/**
 * Court opening and closing instants for one local date.
 *
 * Courts run 07:00–00:00 (BR-12), and the 00:00 close belongs to the next
 * calendar date — so the window is 17 hours, not 7. Getting this wrong is how
 * late-evening slots silently disappear from a schedule.
 */
export function courtDayBounds(
  localDate: string,
  options: { opensAt?: string; closesAt?: string; closesNextDay?: boolean } = {},
): { opensAt: Date; closesAt: Date } {
  const opens = options.opensAt ?? '07:00'
  const closes = options.closesAt ?? '00:00'
  const closesNextDay = options.closesNextDay ?? closes === '00:00'

  return {
    opensAt: businessTimeToInstant(localDate, opens),
    closesAt: businessTimeToInstant(localDate, closes, {
      dayOffset: closesNextDay ? 1 : 0,
    }),
  }
}

/** Today's date in the business timezone, as `YYYY-MM-DD`. */
export function businessToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Shifts a `YYYY-MM-DD` date by whole days without timezone involvement. */
export function addDays(localDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate)
  if (!match) {
    throw new TypeError(`addDays: expected YYYY-MM-DD, received ${localDate}`)
  }

  const [, year, month, day] = match
  const shifted = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days))

  return shifted.toISOString().slice(0, 10)
}

/** Half-open overlap test: `[aStart, aEnd)` against `[bStart, bEnd)`. */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  // Strict comparisons on both sides are what make 10:00-11:00 and
  // 11:00-12:00 non-conflicting (AC-07).
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}
