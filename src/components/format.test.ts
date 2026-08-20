import { describe, expect, it } from 'vitest'

import { formatAttribution, formatCalendarDate, formatCents, formatRange } from './format'
import { ADMIN_STATUS_LABELS, FILTERABLE_STATUSES } from './status'
import type { BookingStatus } from '@/core/types'

describe('formatCalendarDate', () => {
  it('renders a calendar date without going through a Date object', () => {
    expect(formatCalendarDate('2026-08-17')).toBe('Aug 17')
    expect(formatCalendarDate('2026-01-01')).toBe('Jan 1')
    expect(formatCalendarDate('2026-12-31')).toBe('Dec 31')
  })

  it('drops the leading zero from the day', () => {
    expect(formatCalendarDate('2026-08-04')).toBe('Aug 4')
  })

  it('is unaffected by the machine timezone', () => {
    // A Date-based implementation renders this as Aug 16 west of UTC. This
    // is why src/core/dates.ts exists, and the display layer must not
    // reintroduce the bug it avoids.
    expect(formatCalendarDate('2026-08-17')).toBe('Aug 17')
  })
})

describe('formatRange', () => {
  it('renders a range', () => {
    expect(formatRange('2026-08-15', '2026-08-21')).toBe('Aug 15 – Aug 21')
  })

  it('collapses a single-day range', () => {
    expect(formatRange('2026-08-15', '2026-08-15')).toBe('Aug 15')
  })

  it('says so plainly when there are no dates', () => {
    expect(formatRange(null, null)).toBe('No dates yet')
    expect(formatRange('2026-08-15', null)).toBe('No dates yet')
    expect(formatRange(null, '2026-08-21')).toBe('No dates yet')
  })
})

describe('formatCents', () => {
  it('formats integer cents with no floating point drift', () => {
    expect(formatCents(5900)).toBe('$59.00')
    expect(formatCents(1999)).toBe('$19.99')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(0)).toBe('$0.00')
  })

  it('formats a negative amount', () => {
    expect(formatCents(-1000)).toBe('-$10.00')
  })
})

describe('formatAttribution', () => {
  it('renders the Reference data format', () => {
    expect(formatAttribution('Checked', 'Kate Miller', '2026-08-04T14:00:00Z')).toBe(
      'Checked by Kate, Aug 4'
    )
  })

  it('uses the first name only', () => {
    expect(formatAttribution('Set', 'Kate Miller', '2026-08-04T14:00:00Z')).toContain('by Kate,')
    expect(formatAttribution('Set', 'Kate', '2026-08-04T14:00:00Z')).toBe('Set by Kate, Aug 4')
  })

  it('is null when the flag has never been set', () => {
    expect(formatAttribution('Checked', 'Kate', null)).toBeNull()
  })
})

describe('admin status labels', () => {
  it('has a label for every status, matching the Reference data exactly', () => {
    const expected: Record<BookingStatus, string> = {
      inquiry: 'Inquiry',
      tentative: 'Tentative',
      confirmed: 'Confirmed',
      in_progress: 'In progress',
      complete: 'Complete',
      closed: 'Closed',
      declined: 'Declined',
      cancelled: 'Cancelled',
    }
    expect(ADMIN_STATUS_LABELS).toEqual(expected)
  })

  it('offers every status as a filter', () => {
    expect([...FILTERABLE_STATUSES].sort()).toEqual(Object.keys(ADMIN_STATUS_LABELS).sort())
  })

  it('contains no placeholder copy', () => {
    for (const label of Object.values(ADMIN_STATUS_LABELS)) {
      expect(label).not.toMatch(/lorem|tbd|todo|undefined/i)
      expect(label.length).toBeGreaterThan(0)
    }
  })
})
