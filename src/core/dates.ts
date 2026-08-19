/**
 * Calendar date arithmetic on 'YYYY-MM-DD' strings.
 *
 * PURE. No clock, no environment, no input or output. Every function that
 * needs the current instant takes it as an argument.
 *
 * Why this file exists at all, rather than a date library or Date objects:
 * a service range is a calendar date, not an instant. Converting one through
 * a Date and back is where timezone bugs come from — a date near midnight in
 * a zone behind UTC comes back a day early. So the arithmetic below works on
 * the integer day number directly and never constructs a Date. The single
 * exception is todayIn(), which converts a genuine instant into a calendar
 * date and needs zone rules to do it; it is documented at its definition.
 *
 * The algorithms are Howard Hinnant's days_from_civil / civil_from_days,
 * which are exact for all dates in the proleptic Gregorian calendar and use
 * only integer operations.
 */

import type { CalendarDate } from './types'

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Days from 1970-01-01 for a proleptic Gregorian y/m/d. Exact, integer-only. */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0)
  const era = Math.floor(y / 400)
  const yearOfEra = y - era * 400
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

/** Inverse of daysFromCivil. */
function civilFromDays(days: number): { year: number; month: number; day: number } {
  const z = days + 719468
  const era = Math.floor(z / 146097)
  const dayOfEra = z - era * 146097
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365
  )
  const year = yearOfEra + era * 400
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const mp = Math.floor((5 * dayOfYear + 2) / 153)
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1
  const month = mp + (mp < 10 ? 3 : -9)
  return { year: year + (month <= 2 ? 1 : 0), month, day }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function format(year: number, month: number, day: number): CalendarDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as CalendarDate
}

/**
 * True when value is a well-formed 'YYYY-MM-DD' string naming a real date.
 *
 * Shape alone is not enough: '2026-02-30' has the right shape and is not a
 * date. This round-trips through the day number and requires the result to
 * match, which rejects any out-of-range month or day.
 */
export function isValidCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  const roundTripped = civilFromDays(daysFromCivil(year, month, day))
  return roundTripped.year === year && roundTripped.month === month && roundTripped.day === day
}

/**
 * Validate a string and brand it as a CalendarDate.
 *
 * Throws on anything that is not a real date. This is the only way to make a
 * CalendarDate, so an invalid one cannot reach the rest of the domain.
 */
export function toCalendarDate(value: string): CalendarDate {
  if (!isValidCalendarDate(value)) {
    throw new RangeError(`Not a calendar date: ${JSON.stringify(value)}. Expected 'YYYY-MM-DD'.`)
  }
  return value as CalendarDate
}

/** Integer day number for a CalendarDate. Internal to this module's callers. */
function toDayNumber(date: CalendarDate): number {
  const match = CALENDAR_DATE_PATTERN.exec(date)
  if (!match) {
    throw new RangeError(`Not a calendar date: ${JSON.stringify(date)}. Expected 'YYYY-MM-DD'.`)
  }
  return daysFromCivil(Number(match[1]), Number(match[2]), Number(match[3]))
}

function fromDayNumber(days: number): CalendarDate {
  const civil = civilFromDays(days)
  return format(civil.year, civil.month, civil.day)
}

/**
 * The date `count` days after `date`. Negative counts move backward.
 *
 * Crosses month, year, and leap boundaries correctly because it is integer
 * arithmetic on the day number, not field manipulation.
 */
export function addDays(date: CalendarDate, count: number): CalendarDate {
  if (!Number.isInteger(count)) {
    throw new RangeError(`addDays expects a whole number of days, received ${count}.`)
  }
  return fromDayNumber(toDayNumber(date) + count)
}

/**
 * The number of days in the range, counting INCLUSIVELY at both ends.
 *
 * daysBetween('2026-08-01', '2026-08-07') is 7, not 6. This is deliberate
 * and is the basis for per-day pricing: a booking running the first to the
 * seventh is seven days of service and is billed as seven.
 *
 * A single day is 1. An end before the start is 0, matching expandRange
 * returning an empty array for the same input.
 */
export function daysBetween(start: CalendarDate, end: CalendarDate): number {
  const span = toDayNumber(end) - toDayNumber(start)
  return span < 0 ? 0 : span + 1
}

/**
 * Every date from start to end, inclusive of both ends, ascending.
 *
 * Returns an empty array when end is before start rather than throwing:
 * callers routinely hold a range that has not been filled in yet, and an
 * empty schedule is the right answer for an inverted one.
 *
 * Unaffected by daylight saving. No instant is ever constructed, so there
 * is no 23 or 25 hour day for the arithmetic to trip over.
 */
export function expandRange(start: CalendarDate, end: CalendarDate): CalendarDate[] {
  const first = toDayNumber(start)
  const last = toDayNumber(end)
  if (last < first) return []

  const dates: CalendarDate[] = []
  for (let day = first; day <= last; day += 1) {
    dates.push(fromDayNumber(day))
  }
  return dates
}

/** True when date falls within [start, end], inclusive at both ends. */
export function isWithinRange(date: CalendarDate, start: CalendarDate, end: CalendarDate): boolean {
  const target = toDayNumber(date)
  return target >= toDayNumber(start) && target <= toDayNumber(end)
}

/**
 * -1 when a is earlier, 1 when a is later, 0 when they are the same day.
 * Suitable directly as an Array.prototype.sort comparator.
 */
export function compareDates(a: CalendarDate, b: CalendarDate): -1 | 0 | 1 {
  const left = toDayNumber(a)
  const right = toDayNumber(b)
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * The calendar date it is at `instant`, in `timeZone`.
 *
 * READS NO CLOCK. The instant is an argument, so this function is pure and
 * testable: pass the same instant and get the same date, forever.
 *
 * This is the one place a real instant becomes a calendar date, and the one
 * place zone rules are consulted. It uses Intl rather than field arithmetic
 * on a Date because only the zone database knows the offset in effect at a
 * given instant, and that offset is exactly what decides which calendar day
 * an instant falls on.
 */
export function todayIn(timeZone: string, instant: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  let year = ''
  let month = ''
  let day = ''
  for (const part of parts) {
    if (part.type === 'year') year = part.value
    else if (part.type === 'month') month = part.value
    else if (part.type === 'day') day = part.value
  }

  if (!year || !month || !day) {
    throw new RangeError(
      `Could not resolve a calendar date in time zone ${JSON.stringify(timeZone)}.`
    )
  }

  return toCalendarDate(`${year.padStart(4, '0')}-${month}-${day}`)
}
