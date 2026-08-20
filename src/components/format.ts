/**
 * Display formatting. Importing nothing, so tests can assert on it directly.
 *
 * Calendar dates are formatted from their 'YYYY-MM-DD' parts rather than
 * through a Date, which would reintroduce the timezone bug `src/core/dates.ts`
 * exists to avoid: a date near midnight in a zone behind UTC comes back a day
 * early.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '2026-08-17' → 'Aug 17'. */
export function formatCalendarDate(date: string): string {
  const [, month, day] = date.split('-')
  const index = Number(month) - 1
  return `${MONTHS[index] ?? month} ${Number(day)}`
}

/** A service range, or a plain phrase when it has not been settled. */
export function formatRange(start: string | null, end: string | null): string {
  if (start === null || end === null) return 'No dates yet'
  if (start === end) return formatCalendarDate(start)
  return `${formatCalendarDate(start)} – ${formatCalendarDate(end)}`
}

/** Integer cents → '$59.00'. Integer arithmetic only; no float touches money. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  return `${sign}$${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

/** 'Checked by Kate, Aug 4' — the attribution format from the Reference data. */
export function formatAttribution(
  verb: string,
  adminName: string,
  isoTimestamp: string | null
): string | null {
  if (isoTimestamp === null) return null
  const firstName = adminName.split(' ')[0] ?? adminName
  const day = isoTimestamp.slice(0, 10)
  return `${verb} by ${firstName}, ${formatCalendarDate(day)}`
}
