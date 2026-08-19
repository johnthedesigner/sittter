import { describe, it, expect } from 'vitest'
import { priceBooking } from './pricing'
import type { PricingInput } from './pricing'
import { toCalendarDate } from './dates'
import { DEFAULT_PRICING_COMPONENTS } from './types'
import type { AdhocLineItem, BookingCore, PricingComponent, VisitCore } from './types'

const d = toCalendarDate

function booking(overrides: Partial<BookingCore> = {}): BookingCore {
  return {
    id: 'booking-1',
    startDate: d('2026-08-01'),
    endDate: d('2026-08-07'),
    datesApproximate: false,
    datesFirmAt: '2026-07-20T14:00:00Z',
    availabilityCheckedAt: '2026-07-21T09:00:00Z',
    declinedAt: null,
    cancelledAt: null,
    paidAt: null,
    dayCountOverride: null,
    visitCountOverride: null,
    ...overrides,
  }
}

function visit(overrides: Partial<VisitCore> = {}): VisitCore {
  return {
    id: 'visit-1',
    date: d('2026-08-01'),
    window: 'morning',
    durationMinutes: null,
    taskIds: [],
    ...overrides,
  }
}

function visits(count: number, durationMinutes: number | null = null): VisitCore[] {
  return Array.from({ length: count }, (_, i) => visit({ id: `visit-${i + 1}`, durationMinutes }))
}

function input(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    booking: booking(),
    visits: [],
    components: [],
    adhocItems: [],
    ...overrides,
  }
}

describe('priceBooking — the worked example', () => {
  it('prices seven days and four visits with the default profile at 5900 cents', () => {
    // Acceptance criterion, and the reference data's worked example verbatim.
    const result = priceBooking(
      input({ visits: visits(4), components: DEFAULT_PRICING_COMPONENTS })
    )

    expect(result.lineItems).toHaveLength(2)

    expect(result.lineItems[0]).toEqual({
      label: 'Daily rate',
      basis: '7 days at $5.00',
      quantity: 7,
      unitAmountCents: 500,
      amountCents: 3500,
      source: 'component',
    })

    expect(result.lineItems[1]).toEqual({
      label: 'Per visit',
      basis: '4 visits at $6.00',
      quantity: 4,
      unitAmountCents: 600,
      amountCents: 2400,
      source: 'component',
    })

    expect(result.totalCents).toBe(5900)
    expect(result.dayCount).toBe(7)
    expect(result.visitCount).toBe(4)
    expect(result.dayCountWasOverridden).toBe(false)
    expect(result.visitCountWasOverridden).toBe(false)
  })
})

describe('priceBooking — component types', () => {
  const allFive: PricingComponent[] = [
    { id: 'c-day', type: 'per_day', label: 'Daily rate', amountCents: 500, sortOrder: 0 },
    { id: 'c-visit', type: 'per_visit', label: 'Per visit', amountCents: 600, sortOrder: 1 },
    { id: 'c-flat', type: 'flat', label: 'Setup', amountCents: 2500, sortOrder: 2 },
    { id: 'c-hour', type: 'per_hour', label: 'Extended stay', amountCents: 1200, sortOrder: 3 },
    { id: 'c-custom', type: 'custom', label: 'Holiday surcharge', amountCents: 1000, sortOrder: 4 },
  ]

  it('produces five line items in sortOrder order when all five types apply', () => {
    // Acceptance criterion.
    const result = priceBooking(input({ visits: visits(4, 90), components: allFive }))

    expect(result.lineItems).toHaveLength(5)
    expect(result.lineItems.map((i) => i.label)).toEqual([
      'Daily rate',
      'Per visit',
      'Setup',
      'Extended stay',
      'Holiday surcharge',
    ])
  })

  it('orders by sortOrder, not by the order given', () => {
    const shuffled = [...allFive].reverse()
    const result = priceBooking(input({ visits: visits(4, 90), components: shuffled }))
    expect(result.lineItems.map((i) => i.label)).toEqual([
      'Daily rate',
      'Per visit',
      'Setup',
      'Extended stay',
      'Holiday surcharge',
    ])
  })

  it('does not mutate the components array it was given', () => {
    const given = [...allFive].reverse()
    const before = given.map((c) => c.id)
    priceBooking(input({ visits: visits(4, 90), components: given }))
    expect(given.map((c) => c.id)).toEqual(before)
  })
})

describe('priceBooking — per_day counts every calendar day', () => {
  const perDay: PricingComponent[] = [
    { id: 'c-day', type: 'per_day', label: 'Daily rate', amountCents: 500, sortOrder: 0 },
  ]

  it('prices days with no visit, counting the range inclusively', () => {
    // Acceptance criterion. Seven days, one visit: still seven days billed.
    const result = priceBooking(input({ visits: visits(1), components: perDay }))
    expect(result.dayCount).toBe(7)
    expect(result.lineItems[0]?.quantity).toBe(7)
    expect(result.lineItems[0]?.amountCents).toBe(3500)
  })

  it('prices a single-day booking as one day', () => {
    const oneDay = booking({ startDate: d('2026-08-01'), endDate: d('2026-08-01') })
    const result = priceBooking(input({ booking: oneDay, components: perDay }))
    expect(result.dayCount).toBe(1)
    expect(result.lineItems[0]?.basis).toBe('1 day at $5.00')
    expect(result.lineItems[0]?.amountCents).toBe(500)
  })

  it('produces no line item when the booking has no dates yet', () => {
    const undated = booking({ startDate: null, endDate: null })
    const result = priceBooking(input({ booking: undated, components: perDay }))
    expect(result.dayCount).toBe(0)
    expect(result.lineItems).toHaveLength(0)
    expect(result.totalCents).toBe(0)
  })
})

describe('priceBooking — per_hour', () => {
  const perHour: PricingComponent[] = [
    { id: 'c-hour', type: 'per_hour', label: 'Extended stay', amountCents: 1200, sortOrder: 0 },
  ]

  it('prices against the summed visit durations in minutes', () => {
    // Acceptance criterion. Four visits of 90 minutes is 360 minutes, 6 hours.
    const result = priceBooking(input({ visits: visits(4, 90), components: perHour }))
    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]?.quantity).toBe(6)
    expect(result.lineItems[0]?.basis).toBe('6 hours at $12.00')
    expect(result.lineItems[0]?.amountCents).toBe(7200)
  })

  it('produces no line item when every duration is null', () => {
    // Acceptance criterion.
    const result = priceBooking(input({ visits: visits(4, null), components: perHour }))
    expect(result.lineItems).toHaveLength(0)
    expect(result.totalCents).toBe(0)
  })

  it('produces no line item when there are no visits at all', () => {
    const result = priceBooking(input({ visits: [], components: perHour }))
    expect(result.lineItems).toHaveLength(0)
  })

  it('ignores null durations while summing the rest', () => {
    const mixed = [
      visit({ id: 'v1', durationMinutes: 60 }),
      visit({ id: 'v2', durationMinutes: null }),
      visit({ id: 'v3', durationMinutes: 30 }),
    ]
    const result = priceBooking(input({ visits: mixed, components: perHour }))
    expect(result.lineItems[0]?.quantity).toBe(1.5)
    expect(result.lineItems[0]?.basis).toBe('1.5 hours at $12.00')
    expect(result.lineItems[0]?.amountCents).toBe(1800)
  })

  it('says "1 hour", not "1 hours"', () => {
    const oneHour = [visit({ durationMinutes: 60 })]
    const result = priceBooking(input({ visits: oneHour, components: perHour }))
    expect(result.lineItems[0]?.basis).toBe('1 hour at $12.00')
  })

  it('rounds a partial hour to a whole number of cents', () => {
    // 50 minutes at $12.00/hour is 1000 cents exactly.
    const fifty = [visit({ durationMinutes: 50 })]
    const result = priceBooking(input({ visits: fifty, components: perHour }))
    expect(result.lineItems[0]?.amountCents).toBe(1000)
    expect(Number.isInteger(result.lineItems[0]?.amountCents)).toBe(true)

    // 7 minutes at $12.00/hour is 140 cents exactly.
    const seven = [visit({ durationMinutes: 7 })]
    const seven12 = priceBooking(input({ visits: seven, components: perHour }))
    expect(seven12.lineItems[0]?.amountCents).toBe(140)

    // A rate that does not divide evenly still yields whole cents.
    const odd: PricingComponent[] = [
      { id: 'c', type: 'per_hour', label: 'Odd', amountCents: 999, sortOrder: 0 },
    ]
    const result3 = priceBooking(
      input({ visits: [visit({ durationMinutes: 7 })], components: odd })
    )
    expect(Number.isInteger(result3.lineItems[0]?.amountCents)).toBe(true)
    expect(result3.lineItems[0]?.amountCents).toBe(117) // round(7 * 999 / 60)
  })
})

describe('priceBooking — overrides', () => {
  it('a dayCountOverride of 6 against a 7 day range bills 6 days and flags it', () => {
    // Acceptance criterion.
    const overridden = booking({ dayCountOverride: 6 })
    const result = priceBooking(
      input({ booking: overridden, visits: visits(4), components: DEFAULT_PRICING_COMPONENTS })
    )

    expect(result.dayCount).toBe(6)
    expect(result.dayCountWasOverridden).toBe(true)
    expect(result.visitCountWasOverridden).toBe(false)
    expect(result.lineItems[0]?.basis).toBe('6 days at $5.00')
    expect(result.lineItems[0]?.amountCents).toBe(3000)
    expect(result.totalCents).toBe(5400)
  })

  it('a visitCountOverride behaves equivalently', () => {
    // Acceptance criterion.
    const overridden = booking({ visitCountOverride: 3 })
    const result = priceBooking(
      input({ booking: overridden, visits: visits(4), components: DEFAULT_PRICING_COMPONENTS })
    )

    expect(result.visitCount).toBe(3)
    expect(result.visitCountWasOverridden).toBe(true)
    expect(result.dayCountWasOverridden).toBe(false)
    expect(result.lineItems[1]?.basis).toBe('3 visits at $6.00')
    expect(result.lineItems[1]?.amountCents).toBe(1800)
    expect(result.totalCents).toBe(5300)
  })

  it('an override of zero suppresses the line item and is still flagged', () => {
    const zeroed = booking({ visitCountOverride: 0 })
    const result = priceBooking(
      input({ booking: zeroed, visits: visits(4), components: DEFAULT_PRICING_COMPONENTS })
    )
    expect(result.visitCount).toBe(0)
    expect(result.visitCountWasOverridden).toBe(true)
    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]?.label).toBe('Daily rate')
  })

  it('both overrides apply at once', () => {
    const both = booking({ dayCountOverride: 5, visitCountOverride: 2 })
    const result = priceBooking(
      input({ booking: both, visits: visits(4), components: DEFAULT_PRICING_COMPONENTS })
    )
    expect(result.dayCount).toBe(5)
    expect(result.visitCount).toBe(2)
    expect(result.dayCountWasOverridden).toBe(true)
    expect(result.visitCountWasOverridden).toBe(true)
    expect(result.totalCents).toBe(5 * 500 + 2 * 600)
  })

  it('an override does not change the summed durations a per_hour uses', () => {
    const overridden = booking({ visitCountOverride: 1 })
    const perHour: PricingComponent[] = [
      { id: 'c-hour', type: 'per_hour', label: 'Extended stay', amountCents: 1200, sortOrder: 0 },
    ]
    const result = priceBooking(
      input({ booking: overridden, visits: visits(4, 90), components: perHour })
    )
    // Still 360 real minutes, regardless of the count override.
    expect(result.lineItems[0]?.quantity).toBe(6)
  })
})

describe('priceBooking — ad-hoc line items', () => {
  const adhoc = (overrides: Partial<AdhocLineItem> = {}): AdhocLineItem => ({
    id: 'adhoc-1',
    label: 'Extra key cutting',
    amountCents: 1500,
    sortOrder: 0,
    ...overrides,
  })

  it('adds a positive ad-hoc item to the total', () => {
    const result = priceBooking(
      input({
        visits: visits(4),
        components: DEFAULT_PRICING_COMPONENTS,
        adhocItems: [adhoc()],
      })
    )
    expect(result.lineItems).toHaveLength(3)
    expect(result.totalCents).toBe(7400)
  })

  it('a negative ad-hoc amount reduces the total', () => {
    // Acceptance criterion.
    const result = priceBooking(
      input({
        visits: visits(4),
        components: DEFAULT_PRICING_COMPONENTS,
        adhocItems: [adhoc({ label: 'Returning customer discount', amountCents: -1000 })],
      })
    )
    expect(result.totalCents).toBe(4900)
    const discount = result.lineItems.find((i) => i.source === 'adhoc')
    expect(discount?.amountCents).toBe(-1000)
    expect(discount?.label).toBe('Returning customer discount')
  })

  it('places ad-hoc items after components, ordered among themselves by sortOrder', () => {
    const result = priceBooking(
      input({
        visits: visits(4),
        components: DEFAULT_PRICING_COMPONENTS,
        adhocItems: [
          adhoc({ id: 'a2', label: 'Second', amountCents: 100, sortOrder: 1 }),
          adhoc({ id: 'a1', label: 'First', amountCents: 100, sortOrder: 0 }),
        ],
      })
    )
    expect(result.lineItems.map((i) => i.label)).toEqual([
      'Daily rate',
      'Per visit',
      'First',
      'Second',
    ])
    expect(result.lineItems.map((i) => i.source)).toEqual([
      'component',
      'component',
      'adhoc',
      'adhoc',
    ])
  })

  it('keeps an ad-hoc item even with no components at all', () => {
    const result = priceBooking(input({ adhocItems: [adhoc()] }))
    expect(result.lineItems).toHaveLength(1)
    expect(result.totalCents).toBe(1500)
  })
})

describe('priceBooking — a component that does not apply produces no row', () => {
  it('zero visits with a per_visit component produces no line item, not a zero-amount one', () => {
    // Acceptance criterion. A row reading "0 visits at $6.00 — $0.00" is noise.
    const result = priceBooking(input({ visits: [], components: DEFAULT_PRICING_COMPONENTS }))

    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]?.label).toBe('Daily rate')
    expect(result.lineItems.some((i) => i.label === 'Per visit')).toBe(false)
    expect(result.visitCount).toBe(0)
    expect(result.totalCents).toBe(3500)
  })

  it('an empty booking prices to nothing without throwing', () => {
    const result = priceBooking(input())
    expect(result.lineItems).toEqual([])
    expect(result.totalCents).toBe(0)
  })
})

describe('priceBooking — money is integer cents', () => {
  it('every amount in every line item, and the total, is an integer', () => {
    // Acceptance criterion.
    const all: PricingComponent[] = [
      { id: '1', type: 'per_day', label: 'Daily rate', amountCents: 517, sortOrder: 0 },
      { id: '2', type: 'per_visit', label: 'Per visit', amountCents: 633, sortOrder: 1 },
      { id: '3', type: 'flat', label: 'Setup', amountCents: 2501, sortOrder: 2 },
      { id: '4', type: 'per_hour', label: 'Hourly', amountCents: 1237, sortOrder: 3 },
      { id: '5', type: 'custom', label: 'Surcharge', amountCents: 999, sortOrder: 4 },
    ]
    const result = priceBooking(
      input({
        visits: visits(3, 47),
        components: all,
        adhocItems: [{ id: 'a', label: 'Adjustment', amountCents: -333, sortOrder: 0 }],
      })
    )

    for (const item of result.lineItems) {
      expect(Number.isInteger(item.amountCents)).toBe(true)
      expect(Number.isInteger(item.unitAmountCents)).toBe(true)
    }
    expect(Number.isInteger(result.totalCents)).toBe(true)
  })

  it('the total is exactly the sum of the line items', () => {
    const result = priceBooking(
      input({
        visits: visits(4, 90),
        components: DEFAULT_PRICING_COMPONENTS,
        adhocItems: [{ id: 'a', label: 'Discount', amountCents: -750, sortOrder: 0 }],
      })
    )
    const summed = result.lineItems.reduce((acc, i) => acc + i.amountCents, 0)
    expect(result.totalCents).toBe(summed)
  })
})

describe('priceBooking — basis strings', () => {
  it('formats dollars from integer cents, including amounts under a dollar', () => {
    const cheap: PricingComponent[] = [
      { id: '1', type: 'per_day', label: 'Daily rate', amountCents: 5, sortOrder: 0 },
      { id: '2', type: 'per_visit', label: 'Per visit', amountCents: 50, sortOrder: 1 },
      { id: '3', type: 'flat', label: 'Setup', amountCents: 100, sortOrder: 2 },
    ]
    const result = priceBooking(input({ visits: visits(2), components: cheap }))
    expect(result.lineItems[0]?.basis).toBe('7 days at $0.05')
    expect(result.lineItems[1]?.basis).toBe('2 visits at $0.50')
    expect(result.lineItems[2]?.basis).toBe('Flat rate of $1.00')
  })

  it('renders cents without floating point drift', () => {
    const awkward: PricingComponent[] = [
      { id: '1', type: 'flat', label: 'Odd', amountCents: 1999, sortOrder: 0 },
      { id: '2', type: 'custom', label: 'Odder', amountCents: 10, sortOrder: 1 },
    ]
    const result = priceBooking(input({ components: awkward }))
    expect(result.lineItems[0]?.basis).toBe('Flat rate of $19.99')
    expect(result.lineItems[1]?.basis).toBe('Custom charge of $0.10')
  })

  it('says "1 visit", not "1 visits"', () => {
    const perVisit: PricingComponent[] = [
      { id: '1', type: 'per_visit', label: 'Per visit', amountCents: 600, sortOrder: 0 },
    ]
    const result = priceBooking(input({ visits: visits(1), components: perVisit }))
    expect(result.lineItems[0]?.basis).toBe('1 visit at $6.00')
  })
})

describe('priceBooking — purity', () => {
  it('does not touch the clock or randomness', () => {
    const dateCtor = globalThis.Date as unknown as { now: () => number }
    const mathObj = globalThis.Math as unknown as { random: () => number }
    const realNow = dateCtor.now
    const realRandom = mathObj.random
    dateCtor.now = () => {
      throw new Error('src/core/pricing.ts read the clock')
    }
    mathObj.random = () => {
      throw new Error('src/core/pricing.ts read a random source')
    }
    try {
      const result = priceBooking(
        input({ visits: visits(4), components: DEFAULT_PRICING_COMPONENTS })
      )
      expect(result.totalCents).toBe(5900)
    } finally {
      dateCtor.now = realNow
      mathObj.random = realRandom
    }
  })

  it('does not mutate its input', () => {
    const given = input({ visits: visits(4), components: DEFAULT_PRICING_COMPONENTS })
    const before = JSON.stringify(given)
    priceBooking(given)
    expect(JSON.stringify(given)).toBe(before)
  })
})
