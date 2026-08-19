import { describe, it, expect } from 'vitest'
import {
  addDays,
  compareDates,
  daysBetween,
  expandRange,
  isValidCalendarDate,
  isWithinRange,
  toCalendarDate,
  todayIn,
} from './dates'

const d = toCalendarDate

describe('isValidCalendarDate', () => {
  it('accepts a real date', () => {
    expect(isValidCalendarDate('2026-08-01')).toBe(true)
  })

  it('rejects a day that does not exist in that month', () => {
    // Acceptance criterion: shape alone must not be enough.
    expect(isValidCalendarDate('2026-02-30')).toBe(false)
    expect(isValidCalendarDate('2026-04-31')).toBe(false)
    expect(isValidCalendarDate('2026-06-31')).toBe(false)
  })

  it('handles February across leap and common years', () => {
    expect(isValidCalendarDate('2024-02-29')).toBe(true) // divisible by 4
    expect(isValidCalendarDate('2026-02-29')).toBe(false) // common year
    expect(isValidCalendarDate('2000-02-29')).toBe(true) // divisible by 400
    expect(isValidCalendarDate('1900-02-29')).toBe(false) // divisible by 100, not 400
  })

  it('rejects out-of-range months and days', () => {
    expect(isValidCalendarDate('2026-00-10')).toBe(false)
    expect(isValidCalendarDate('2026-13-10')).toBe(false)
    expect(isValidCalendarDate('2026-01-00')).toBe(false)
    expect(isValidCalendarDate('2026-01-32')).toBe(false)
  })

  it('rejects anything not shaped as YYYY-MM-DD', () => {
    expect(isValidCalendarDate('2026-8-1')).toBe(false)
    expect(isValidCalendarDate('08/01/2026')).toBe(false)
    expect(isValidCalendarDate('2026-08-01T00:00:00Z')).toBe(false)
    expect(isValidCalendarDate('')).toBe(false)
    expect(isValidCalendarDate('not a date')).toBe(false)
  })
})

describe('toCalendarDate', () => {
  it('returns the same string it was given', () => {
    expect(toCalendarDate('2026-08-01')).toBe('2026-08-01')
  })

  it('throws on an invalid date, naming the value', () => {
    expect(() => toCalendarDate('2026-02-30')).toThrow(RangeError)
    expect(() => toCalendarDate('2026-02-30')).toThrow(/2026-02-30/)
  })
})

describe('addDays', () => {
  it('crosses a month boundary', () => {
    // Acceptance criterion.
    expect(addDays(d('2026-08-31'), 1)).toBe('2026-09-01')
  })

  it('crosses a year boundary', () => {
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addDays(d('2027-01-01'), -1)).toBe('2026-12-31')
  })

  it('crosses February in a leap year and a common year', () => {
    expect(addDays(d('2024-02-28'), 1)).toBe('2024-02-29')
    expect(addDays(d('2024-02-29'), 1)).toBe('2024-03-01')
    expect(addDays(d('2026-02-28'), 1)).toBe('2026-03-01')
  })

  it('moves backward on a negative count', () => {
    expect(addDays(d('2026-09-01'), -1)).toBe('2026-08-31')
    expect(addDays(d('2026-01-01'), -365)).toBe('2025-01-01')
  })

  it('returns the same date for zero', () => {
    expect(addDays(d('2026-08-01'), 0)).toBe('2026-08-01')
  })

  it('is unaffected by the daylight saving transition', () => {
    // 2026-03-08 is the spring-forward date in America/New_York. A Date-based
    // implementation adding 24 hours here lands on the 8th twice.
    expect(addDays(d('2026-03-07'), 1)).toBe('2026-03-08')
    expect(addDays(d('2026-03-08'), 1)).toBe('2026-03-09')
    // 2026-11-01 is the fall-back date.
    expect(addDays(d('2026-10-31'), 1)).toBe('2026-11-01')
    expect(addDays(d('2026-11-01'), 1)).toBe('2026-11-02')
  })

  it('round-trips over a long span', () => {
    expect(addDays(addDays(d('2026-08-01'), 10_000), -10_000)).toBe('2026-08-01')
  })

  it('rejects a fractional count', () => {
    expect(() => addDays(d('2026-08-01'), 1.5)).toThrow(RangeError)
  })
})

describe('daysBetween', () => {
  it('counts inclusively, matching the per-day pricing basis', () => {
    // Acceptance criterion: seven, not six. The first through the seventh is
    // seven days of service and is billed as seven.
    expect(daysBetween(d('2026-08-01'), d('2026-08-07'))).toBe(7)
  })

  it('returns 1 for a single day', () => {
    expect(daysBetween(d('2026-08-01'), d('2026-08-01'))).toBe(1)
  })

  it('returns 0 when the end precedes the start', () => {
    expect(daysBetween(d('2026-08-07'), d('2026-08-01'))).toBe(0)
  })

  it('agrees with the length of expandRange', () => {
    const start = d('2026-02-25')
    const end = d('2026-03-04')
    expect(daysBetween(start, end)).toBe(expandRange(start, end).length)
  })

  it('counts a leap year correctly', () => {
    expect(daysBetween(d('2024-01-01'), d('2024-12-31'))).toBe(366)
    expect(daysBetween(d('2026-01-01'), d('2026-12-31'))).toBe(365)
  })

  it('is unaffected by the daylight saving transition', () => {
    expect(daysBetween(d('2026-03-07'), d('2026-03-09'))).toBe(3)
    expect(daysBetween(d('2026-10-31'), d('2026-11-02'))).toBe(3)
  })
})

describe('expandRange', () => {
  it('returns seven dates for a seven day range, inclusive of both ends', () => {
    // Acceptance criterion.
    expect(expandRange(d('2026-08-01'), d('2026-08-07'))).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ])
  })

  it('returns exactly three dates across the spring daylight saving change', () => {
    // Acceptance criterion. 2026-03-08 is spring-forward in America/New_York.
    expect(expandRange(d('2026-03-07'), d('2026-03-09'))).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
    ])
  })

  it('returns exactly one date for a single-day range', () => {
    // Acceptance criterion. 2026-11-01 is fall-back in America/New_York.
    expect(expandRange(d('2026-11-01'), d('2026-11-01'))).toEqual(['2026-11-01'])
  })

  it('returns an empty array when the end precedes the start, without throwing', () => {
    // Acceptance criterion. A range not yet filled in is not an error.
    expect(expandRange(d('2026-08-07'), d('2026-08-01'))).toEqual([])
  })

  it('crosses a month boundary', () => {
    expect(expandRange(d('2026-08-30'), d('2026-09-02'))).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ])
  })

  it('includes 29 February in a leap year and omits it otherwise', () => {
    expect(expandRange(d('2024-02-28'), d('2024-03-01'))).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ])
    expect(expandRange(d('2026-02-28'), d('2026-03-01'))).toEqual(['2026-02-28', '2026-03-01'])
  })

  it('returns strictly ascending dates with no duplicates', () => {
    const range = expandRange(d('2026-10-28'), d('2026-11-04'))
    expect(range).toHaveLength(8)
    expect(new Set(range).size).toBe(8)
    for (let i = 1; i < range.length; i += 1) {
      expect(compareDates(range[i - 1]!, range[i]!)).toBe(-1)
    }
  })
})

describe('isWithinRange', () => {
  const start = d('2026-08-01')
  const end = d('2026-08-07')

  it('includes both endpoints', () => {
    expect(isWithinRange(d('2026-08-01'), start, end)).toBe(true)
    expect(isWithinRange(d('2026-08-07'), start, end)).toBe(true)
  })

  it('includes an interior date', () => {
    expect(isWithinRange(d('2026-08-04'), start, end)).toBe(true)
  })

  it('excludes the days immediately outside', () => {
    expect(isWithinRange(d('2026-07-31'), start, end)).toBe(false)
    expect(isWithinRange(d('2026-08-08'), start, end)).toBe(false)
  })

  it('is true only on the day itself for a single-day range', () => {
    expect(isWithinRange(d('2026-08-01'), start, start)).toBe(true)
    expect(isWithinRange(d('2026-08-02'), start, start)).toBe(false)
  })
})

describe('compareDates', () => {
  it('returns -1, 0, and 1', () => {
    expect(compareDates(d('2026-08-01'), d('2026-08-02'))).toBe(-1)
    expect(compareDates(d('2026-08-02'), d('2026-08-01'))).toBe(1)
    expect(compareDates(d('2026-08-01'), d('2026-08-01'))).toBe(0)
  })

  it('compares across month and year boundaries', () => {
    expect(compareDates(d('2026-08-31'), d('2026-09-01'))).toBe(-1)
    expect(compareDates(d('2027-01-01'), d('2026-12-31'))).toBe(1)
  })

  it('sorts an array into ascending order', () => {
    const dates = [d('2026-09-01'), d('2026-08-01'), d('2026-08-31')]
    expect([...dates].sort(compareDates)).toEqual(['2026-08-01', '2026-08-31', '2026-09-01'])
  })
})

describe('todayIn', () => {
  it('reads no clock — the same instant always yields the same date', () => {
    // Acceptance criterion. Two calls, one instant, one answer, forever.
    const instant = new Date('2026-08-17T15:30:00Z')
    expect(todayIn('America/New_York', instant)).toBe('2026-08-17')
    expect(todayIn('America/New_York', instant)).toBe('2026-08-17')
  })

  it('resolves the local day, not the UTC day, near midnight', () => {
    // 03:30 UTC on the 18th is 23:30 on the 17th in New York during EDT.
    // This is the bug the whole module exists to avoid.
    const lateEvening = new Date('2026-08-18T03:30:00Z')
    expect(todayIn('America/New_York', lateEvening)).toBe('2026-08-17')
    expect(todayIn('UTC', lateEvening)).toBe('2026-08-18')
  })

  it('respects the offset in effect at that instant, across both DST changes', () => {
    // Standard time: New York is UTC-5, so 04:30 UTC is still the prior day.
    const winter = new Date('2026-01-15T04:30:00Z')
    expect(todayIn('America/New_York', winter)).toBe('2026-01-14')

    // Daylight time: New York is UTC-4, so 03:30 UTC is still the prior day
    // but 04:30 UTC has rolled over.
    const summer = new Date('2026-07-15T04:30:00Z')
    expect(todayIn('America/New_York', summer)).toBe('2026-07-15')
  })

  it('gives different dates for the same instant in different zones', () => {
    const instant = new Date('2026-08-17T23:00:00Z')
    expect(todayIn('America/New_York', instant)).toBe('2026-08-17')
    expect(todayIn('Asia/Tokyo', instant)).toBe('2026-08-18')
  })

  it('returns a value the rest of the module accepts', () => {
    const today = todayIn('America/New_York', new Date('2026-08-17T15:30:00Z'))
    expect(isValidCalendarDate(today)).toBe(true)
    expect(addDays(today, 1)).toBe('2026-08-18')
  })
})

describe('purity', () => {
  it('does not read the clock or randomness when any function is called', () => {
    // The lint rule in eslint.config.mjs is the enforcement — it was proved to
    // fire before being trusted. This is the runtime counterpart: it makes the
    // clock and the random source throw, then exercises every exported
    // function. Anything reaching for either one fails loudly here.
    //
    // Reached indirectly through a binding so that asserting on purity does
    // not itself breach the src/core/ boundary this file is tested under.
    const dateCtor = globalThis.Date as unknown as { now: () => number }
    const mathObj = globalThis.Math as unknown as { random: () => number }
    const realNow = dateCtor.now
    const realRandom = mathObj.random

    dateCtor.now = () => {
      throw new Error('src/core/dates.ts read the clock')
    }
    mathObj.random = () => {
      throw new Error('src/core/dates.ts read a random source')
    }

    try {
      const start = toCalendarDate('2026-08-01')
      const end = toCalendarDate('2026-08-07')

      expect(isValidCalendarDate('2026-08-01')).toBe(true)
      expect(addDays(start, 45)).toBe('2026-09-15')
      expect(daysBetween(start, end)).toBe(7)
      expect(expandRange(start, end)).toHaveLength(7)
      expect(isWithinRange(end, start, end)).toBe(true)
      expect(compareDates(start, end)).toBe(-1)
      expect(todayIn('America/New_York', new Date('2026-08-17T15:30:00Z'))).toBe('2026-08-17')
    } finally {
      dateCtor.now = realNow
      mathObj.random = realRandom
    }
  })
})
