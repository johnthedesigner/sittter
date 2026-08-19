import { describe, it, expect } from 'vitest'
import {
  CUSTOMER_FACING_LABELS,
  toCustomerFacingLabel,
  toCustomerFacingStatus,
  truncateNote,
} from './presentation'
import { toCalendarDate } from './dates'
import type { BookingCore, BookingStatus } from './types'

const d = toCalendarDate

function booking(overrides: Partial<BookingCore> = {}): BookingCore {
  return {
    id: 'booking-1',
    startDate: d('2026-08-18'),
    endDate: d('2026-08-25'),
    datesApproximate: false,
    datesFirmAt: '2026-08-10T14:00:00Z',
    availabilityCheckedAt: '2026-08-11T09:00:00Z',
    declinedAt: null,
    cancelledAt: null,
    paidAt: null,
    dayCountOverride: null,
    visitCountOverride: null,
    ...overrides,
  }
}

const firm = booking()
const notFirm = booking({ datesFirmAt: null })

describe('toCustomerFacingLabel — one test per row of the mapping table', () => {
  it('inquiry shows "Requested"', () => {
    expect(toCustomerFacingLabel('inquiry', firm)).toBe('Requested')
  })

  it('tentative with datesFirmAt null shows "Waiting on you"', () => {
    expect(toCustomerFacingLabel('tentative', notFirm)).toBe('Waiting on you')
  })

  it('tentative with datesFirmAt set shows "Waiting on us"', () => {
    expect(toCustomerFacingLabel('tentative', firm)).toBe('Waiting on us')
  })

  it('confirmed shows "Confirmed"', () => {
    expect(toCustomerFacingLabel('confirmed', firm)).toBe('Confirmed')
  })

  it('in_progress shows "In progress"', () => {
    expect(toCustomerFacingLabel('in_progress', firm)).toBe('In progress')
  })

  it('complete shows "Complete"', () => {
    expect(toCustomerFacingLabel('complete', firm)).toBe('Complete')
  })

  it('closed shows "Complete" — payment is not a customer-facing distinction', () => {
    expect(toCustomerFacingLabel('closed', firm)).toBe('Complete')
  })

  it('declined shows "Cancelled" — the customer is not told which side ended it', () => {
    expect(toCustomerFacingLabel('declined', firm)).toBe('Cancelled')
  })

  it('cancelled shows "Cancelled"', () => {
    expect(toCustomerFacingLabel('cancelled', firm)).toBe('Cancelled')
  })
})

describe('toCustomerFacingStatus', () => {
  it('maps every internal status to a customer-facing one', () => {
    const all: BookingStatus[] = [
      'inquiry',
      'tentative',
      'confirmed',
      'in_progress',
      'complete',
      'closed',
      'declined',
      'cancelled',
    ]
    for (const status of all) {
      const mapped = toCustomerFacingStatus(status, firm)
      expect(Object.keys(CUSTOMER_FACING_LABELS)).toContain(mapped)
    }
  })

  it('splits tentative on which side is holding things up', () => {
    expect(toCustomerFacingStatus('tentative', notFirm)).toBe('waiting_on_you')
    expect(toCustomerFacingStatus('tentative', firm)).toBe('waiting_on_us')
  })

  it('collapses closed into complete and declined into cancelled', () => {
    expect(toCustomerFacingStatus('closed', firm)).toBe('complete')
    expect(toCustomerFacingStatus('complete', firm)).toBe('complete')
    expect(toCustomerFacingStatus('declined', firm)).toBe('cancelled')
    expect(toCustomerFacingStatus('cancelled', firm)).toBe('cancelled')
  })

  it('never returns an internal status name', () => {
    const internalOnly = ['inquiry', 'tentative', 'closed', 'declined']
    const all: BookingStatus[] = [
      'inquiry',
      'tentative',
      'confirmed',
      'in_progress',
      'complete',
      'closed',
      'declined',
      'cancelled',
    ]
    for (const status of all) {
      expect(internalOnly).not.toContain(toCustomerFacingStatus(status, firm))
    }
  })
})

describe('CUSTOMER_FACING_LABELS', () => {
  it('has a written label for every customer-facing status', () => {
    expect(Object.values(CUSTOMER_FACING_LABELS)).toEqual([
      'Requested',
      'Waiting on you',
      'Waiting on us',
      'Confirmed',
      'In progress',
      'Complete',
      'Cancelled',
    ])
  })

  it('contains no placeholder copy', () => {
    for (const label of Object.values(CUSTOMER_FACING_LABELS)) {
      expect(label.length).toBeGreaterThan(0)
      expect(label).not.toMatch(/lorem|ipsum|tbd|todo|coming soon/i)
    }
  })
})

describe('truncateNote', () => {
  const sixty = 'a'.repeat(60)

  it('returns a 60-character note unchanged, with no ellipsis', () => {
    // Acceptance criterion. An ellipsis on a complete note is a lie.
    expect(truncateNote(sixty)).toBe(sixty)
    expect(truncateNote(sixty)).toHaveLength(60)
    expect(truncateNote(sixty)).not.toContain('…')
  })

  it('returns a shorter note unchanged', () => {
    expect(truncateNote('Fed the cat.')).toBe('Fed the cat.')
    expect(truncateNote('')).toBe('')
  })

  it('cuts a 90-character note at a word boundary and appends one ellipsis', () => {
    // Acceptance criterion, with a note of exactly 90 characters.
    const note =
      'Walked the dog twice around the block, refilled both water bowls, and locked up behind me.'
    expect(note).toHaveLength(90)

    const result = truncateNote(note)

    expect(result.endsWith('…')).toBe(true)
    // At most 60 characters of text, plus the single ellipsis character.
    expect(result.slice(0, -1).length).toBeLessThanOrEqual(60)
    expect(result).toHaveLength(59)
    // Whole words only: the kept text is a prefix of the original, and the
    // character following it in the original is a space, not a letter.
    const kept = result.slice(0, -1)
    expect(note.startsWith(kept)).toBe(true)
    expect(note[kept.length]).toBe(' ')
    expect(result).toBe('Walked the dog twice around the block, refilled both water…')
  })

  it('appends exactly one ellipsis character, not three dots', () => {
    const result = truncateNote('word '.repeat(30))
    expect(result).not.toContain('...')
    expect((result.match(/…/g) ?? []).length).toBe(1)
  })

  it('leaves no trailing space before the ellipsis', () => {
    const note = 'abcd '.repeat(40)
    expect(truncateNote(note)).not.toMatch(/ …$/)
  })

  it('respects a custom maxLength', () => {
    const note = 'one two three four five six seven eight nine ten'
    expect(truncateNote(note, 11)).toBe('one two…')
    expect(truncateNote(note, 7)).toBe('one two…')
    expect(truncateNote(note, 1000)).toBe(note)
  })

  it('cuts mid-word when the first word does not fit', () => {
    // No word boundary exists, so an empty string would be the alternative.
    expect(truncateNote('supercalifragilistic', 5)).toBe('super…')
  })

  it('is exact at the boundary between kept and truncated', () => {
    const sixtyOne = 'b'.repeat(61)
    expect(truncateNote(sixty)).toBe(sixty)
    expect(truncateNote(sixtyOne)).toBe(`${'b'.repeat(60)}…`)
  })

  it('rejects a non-positive maxLength', () => {
    expect(() => truncateNote('anything', 0)).toThrow(RangeError)
    expect(() => truncateNote('anything', -5)).toThrow(RangeError)
  })
})
