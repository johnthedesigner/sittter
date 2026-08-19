import { describe, it, expect } from 'vitest'
import { deriveStatus } from './status'
import { toCalendarDate } from './dates'
import type { BookingCore } from './types'

const d = toCalendarDate
const TODAY = d('2026-08-17')

/** A booking that derives `confirmed`: committed to, range starts tomorrow. */
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

describe('deriveStatus — one test per row of the derivation table', () => {
  it('row 1: cancelledAt set derives cancelled', () => {
    expect(deriveStatus(booking({ cancelledAt: '2026-08-12T10:00:00Z' }), TODAY)).toBe('cancelled')
  })

  it('row 2: declinedAt set derives declined', () => {
    expect(deriveStatus(booking({ declinedAt: '2026-08-12T10:00:00Z' }), TODAY)).toBe('declined')
  })

  it('row 3: a missing start or end date derives inquiry', () => {
    expect(deriveStatus(booking({ startDate: null }), TODAY)).toBe('inquiry')
    expect(deriveStatus(booking({ endDate: null }), TODAY)).toBe('inquiry')
    expect(deriveStatus(booking({ startDate: null, endDate: null }), TODAY)).toBe('inquiry')
  })

  it('row 4: either confirmation flag missing derives tentative', () => {
    expect(deriveStatus(booking({ datesFirmAt: null }), TODAY)).toBe('tentative')
    expect(deriveStatus(booking({ availabilityCheckedAt: null }), TODAY)).toBe('tentative')
    expect(deriveStatus(booking({ datesFirmAt: null, availabilityCheckedAt: null }), TODAY)).toBe(
      'tentative'
    )
  })

  it('row 5: ended before today and paid derives closed', () => {
    const past = booking({
      startDate: d('2026-08-01'),
      endDate: d('2026-08-07'),
      paidAt: d('2026-08-08'),
    })
    expect(deriveStatus(past, TODAY)).toBe('closed')
  })

  it('row 6: ended before today and unpaid derives complete', () => {
    const past = booking({
      startDate: d('2026-08-01'),
      endDate: d('2026-08-07'),
      paidAt: null,
    })
    expect(deriveStatus(past, TODAY)).toBe('complete')
  })

  it('row 7: today inside the range derives in_progress', () => {
    const current = booking({ startDate: d('2026-08-15'), endDate: d('2026-08-20') })
    expect(deriveStatus(current, TODAY)).toBe('in_progress')
  })

  it('row 8: committed to and not yet started derives confirmed', () => {
    expect(deriveStatus(booking(), TODAY)).toBe('confirmed')
  })
})

describe('deriveStatus — precedence, where the ordering earns its keep', () => {
  it('cancelled outranks both flags and a future range', () => {
    // Acceptance criterion. Every reason to call this confirmed is present.
    const cancelled = booking({
      startDate: d('2026-09-01'),
      endDate: d('2026-09-08'),
      datesFirmAt: '2026-08-01T12:00:00Z',
      availabilityCheckedAt: '2026-08-02T12:00:00Z',
      cancelledAt: '2026-08-14T12:00:00Z',
    })
    expect(deriveStatus(cancelled, TODAY)).toBe('cancelled')
  })

  it('declined outranks a past end date and a paid date', () => {
    // Acceptance criterion. Would otherwise derive closed.
    const declined = booking({
      startDate: d('2026-08-01'),
      endDate: d('2026-08-07'),
      paidAt: d('2026-08-08'),
      declinedAt: '2026-07-30T12:00:00Z',
    })
    expect(deriveStatus(declined, TODAY)).toBe('declined')
  })

  it('cancelled outranks declined when both are set', () => {
    const both = booking({
      declinedAt: '2026-08-01T12:00:00Z',
      cancelledAt: '2026-08-02T12:00:00Z',
    })
    expect(deriveStatus(both, TODAY)).toBe('cancelled')
  })

  it('a start date with no end date derives inquiry, not tentative', () => {
    // Acceptance criterion. Both flags set; the missing end date still wins.
    const halfDated = booking({ startDate: d('2026-08-18'), endDate: null })
    expect(deriveStatus(halfDated, TODAY)).toBe('inquiry')
  })

  it('tentative outranks in_progress, complete, and closed', () => {
    const runningButUnchecked = booking({
      startDate: d('2026-08-15'),
      endDate: d('2026-08-20'),
      availabilityCheckedAt: null,
    })
    expect(deriveStatus(runningButUnchecked, TODAY)).toBe('tentative')

    const finishedButUnfirm = booking({
      startDate: d('2026-08-01'),
      endDate: d('2026-08-07'),
      paidAt: d('2026-08-08'),
      datesFirmAt: null,
    })
    expect(deriveStatus(finishedButUnfirm, TODAY)).toBe('tentative')
  })

  it('closed outranks complete when a paid date is present', () => {
    const past = { startDate: d('2026-08-01'), endDate: d('2026-08-07') }
    expect(deriveStatus(booking({ ...past, paidAt: d('2026-08-09') }), TODAY)).toBe('closed')
    expect(deriveStatus(booking({ ...past, paidAt: null }), TODAY)).toBe('complete')
  })
})

describe('deriveStatus — the boundaries of the range', () => {
  it('is in_progress on the first day', () => {
    const b = booking({ startDate: TODAY, endDate: d('2026-08-25') })
    expect(deriveStatus(b, TODAY)).toBe('in_progress')
  })

  it('is in_progress on the last day, not complete', () => {
    // The engagement is not over until the day after it ends.
    const b = booking({ startDate: d('2026-08-10'), endDate: TODAY })
    expect(deriveStatus(b, TODAY)).toBe('in_progress')
  })

  it('is in_progress for a single-day booking on that day', () => {
    const b = booking({ startDate: TODAY, endDate: TODAY })
    expect(deriveStatus(b, TODAY)).toBe('in_progress')
  })

  it('turns complete the day after the end date', () => {
    const b = booking({ startDate: d('2026-08-10'), endDate: d('2026-08-16') })
    expect(deriveStatus(b, TODAY)).toBe('complete')
  })

  it('is confirmed the day before the start date', () => {
    const b = booking({ startDate: d('2026-08-18'), endDate: d('2026-08-25') })
    expect(deriveStatus(b, TODAY)).toBe('confirmed')
  })

  it('a paid date on a booking that has not ended does not make it closed', () => {
    const b = booking({ startDate: d('2026-08-15'), endDate: d('2026-08-20'), paidAt: TODAY })
    expect(deriveStatus(b, TODAY)).toBe('in_progress')
  })
})

describe('deriveStatus — purity', () => {
  it('reads today from its argument, not from a clock', () => {
    // Acceptance criterion. The same booking derives different statuses on
    // different days, and nothing but the argument decides which.
    const b = booking({ startDate: d('2026-08-15'), endDate: d('2026-08-20') })
    expect(deriveStatus(b, d('2026-08-14'))).toBe('confirmed')
    expect(deriveStatus(b, d('2026-08-15'))).toBe('in_progress')
    expect(deriveStatus(b, d('2026-08-20'))).toBe('in_progress')
    expect(deriveStatus(b, d('2026-08-21'))).toBe('complete')
  })

  it('does not touch the clock or randomness when called', () => {
    const dateCtor = globalThis.Date as unknown as { now: () => number }
    const mathObj = globalThis.Math as unknown as { random: () => number }
    const realNow = dateCtor.now
    const realRandom = mathObj.random
    dateCtor.now = () => {
      throw new Error('src/core/status.ts read the clock')
    }
    mathObj.random = () => {
      throw new Error('src/core/status.ts read a random source')
    }
    try {
      expect(deriveStatus(booking(), TODAY)).toBe('confirmed')
    } finally {
      dateCtor.now = realNow
      mathObj.random = realRandom
    }
  })

  it('does not mutate the booking it is given', () => {
    const b = booking()
    const before = JSON.stringify(b)
    deriveStatus(b, TODAY)
    expect(JSON.stringify(b)).toBe(before)
  })
})
