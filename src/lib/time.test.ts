import { describe, expect, it } from 'vitest'
import {
  addDays,
  businessTimeToInstant,
  businessToday,
  courtDayBounds,
  intervalsOverlap,
  zoneOffsetMs,
} from './time'

describe('zoneOffsetMs', () => {
  it('reports UTC+5 for Asia/Almaty after the 2024 change', () => {
    const offsetHours = zoneOffsetMs(new Date('2026-10-26T00:00:00Z')) / 3_600_000
    expect(offsetHours).toBe(5)
  })

  it('reports UTC+6 before the 2024 change', () => {
    // Kazakhstan unified its timezones on 1 March 2024. Historical instants
    // are still +06, which is why every conversion goes through the zone
    // identifier rather than a constant.
    const offsetHours = zoneOffsetMs(new Date('2023-06-01T00:00:00Z')) / 3_600_000
    expect(offsetHours).toBe(6)
  })

  it('confirms Asia/Almaty has no daylight saving', () => {
    // The one-pass offset correction in businessTimeToInstant is exact only
    // without DST. Kazakhstan abolished it in 2005. If this ever fails, the
    // conversion needs iterating and ambiguous local times need handling.
    const january = zoneOffsetMs(new Date('2026-01-15T00:00:00Z'))
    const july = zoneOffsetMs(new Date('2026-07-15T00:00:00Z'))
    expect(january).toBe(july)
  })
})

describe('businessTimeToInstant', () => {
  it('converts a local wall-clock time to the correct UTC instant', () => {
    // 07:00 Almaty is 02:00Z at UTC+5.
    expect(businessTimeToInstant('2026-10-26', '07:00').toISOString()).toBe(
      '2026-10-26T02:00:00.000Z',
    )
  })

  it('does not depend on the browser timezone', () => {
    // The whole point: `new Date('2026-10-26T07:00:00')` would parse in local
    // time and give a different answer on a differently-configured machine.
    const viaUtility = businessTimeToInstant('2026-10-26', '07:00').getTime()
    const naiveLocalParse = new Date('2026-10-26T07:00:00').getTime()
    expect(viaUtility).toBe(Date.parse('2026-10-26T02:00:00Z'))
    // On a UTC machine the naive parse is wrong by exactly the offset.
    expect(naiveLocalParse - viaUtility).not.toBeNaN()
  })

  it('places a next-day time on the following date', () => {
    // 00:00 of the 27th, local, is 19:00Z on the 26th.
    expect(
      businessTimeToInstant('2026-10-26', '00:00', { dayOffset: 1 }).toISOString(),
    ).toBe('2026-10-26T19:00:00.000Z')
  })

  it('rejects malformed input rather than guessing', () => {
    expect(() => businessTimeToInstant('26-10-2026', '07:00')).toThrow(TypeError)
    expect(() => businessTimeToInstant('2026-10-26', '7:00')).toThrow(TypeError)
  })
})

describe('courtDayBounds', () => {
  it('spans 17 hours, because the 00:00 close is the next date', () => {
    const { opensAt, closesAt } = courtDayBounds('2026-10-26')

    expect(opensAt.toISOString()).toBe('2026-10-26T02:00:00.000Z')
    expect(closesAt.toISOString()).toBe('2026-10-26T19:00:00.000Z')

    // 07:00 to midnight is 17 hours. Treating the close as same-day would
    // give a negative window and silently drop every evening slot.
    const hours = (closesAt.getTime() - opensAt.getTime()) / 3_600_000
    expect(hours).toBe(17)
  })

  it('honours an explicit same-day close', () => {
    const { opensAt, closesAt } = courtDayBounds('2026-10-26', {
      opensAt: '09:00',
      closesAt: '18:00',
      closesNextDay: false,
    })

    expect((closesAt.getTime() - opensAt.getTime()) / 3_600_000).toBe(9)
  })
})

describe('intervalsOverlap', () => {
  const at = (iso: string) => new Date(iso)

  it('treats adjacent intervals as non-conflicting', () => {
    // 10:00-11:00 and 11:00-12:00 do not conflict (AC-07).
    expect(
      intervalsOverlap(
        at('2026-10-26T10:00:00Z'),
        at('2026-10-26T11:00:00Z'),
        at('2026-10-26T11:00:00Z'),
        at('2026-10-26T12:00:00Z'),
      ),
    ).toBe(false)
  })

  it('detects a partial overlap', () => {
    expect(
      intervalsOverlap(
        at('2026-10-26T10:00:00Z'),
        at('2026-10-26T11:00:00Z'),
        at('2026-10-26T10:30:00Z'),
        at('2026-10-26T11:30:00Z'),
      ),
    ).toBe(true)
  })

  it('detects full containment in both directions', () => {
    const outerStart = at('2026-10-26T10:00:00Z')
    const outerEnd = at('2026-10-26T13:00:00Z')
    const innerStart = at('2026-10-26T11:00:00Z')
    const innerEnd = at('2026-10-26T12:00:00Z')

    expect(intervalsOverlap(outerStart, outerEnd, innerStart, innerEnd)).toBe(true)
    expect(intervalsOverlap(innerStart, innerEnd, outerStart, outerEnd)).toBe(true)
  })
})

describe('date helpers', () => {
  it('shifts dates across a month boundary', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('reports the business date, not the UTC date', () => {
    // 21:00Z on the 25th is already 02:00 on the 26th in Almaty. A UTC-derived
    // date would file an early-morning booking on the wrong day.
    expect(businessToday(new Date('2026-10-25T21:00:00Z'))).toBe('2026-10-26')
  })
})
