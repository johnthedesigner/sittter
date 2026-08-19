import { describe, it, expect } from 'vitest'
import { buildDigestModel } from './digest'
import type { DigestBookingInput, DigestInput } from './digest'
import { toCalendarDate } from './dates'
import type { BookingCore, CareInstruction, DigestWeather, VisitCore } from './types'

const d = toCalendarDate
const TODAY = d('2026-08-17')

function booking(overrides: Partial<BookingCore> = {}): BookingCore {
  return {
    id: 'booking-1',
    startDate: d('2026-08-15'),
    endDate: d('2026-08-20'),
    datesApproximate: false,
    datesFirmAt: '2026-08-01T14:00:00Z',
    availabilityCheckedAt: '2026-08-02T09:00:00Z',
    declinedAt: null,
    cancelledAt: null,
    paidAt: null,
    dayCountOverride: null,
    visitCountOverride: null,
    ...overrides,
  }
}

function visit(date: string, overrides: Partial<VisitCore> = {}): VisitCore {
  return {
    id: `visit-${date}`,
    date: d(date),
    window: 'morning',
    durationMinutes: null,
    taskIds: [],
    ...overrides,
  }
}

function instruction(overrides: Partial<CareInstruction> = {}): CareInstruction {
  return {
    id: 'task-cat',
    label: 'Feed the cat',
    detail: null,
    cadence: 'every_day',
    cadenceCustom: null,
    weatherRelevant: false,
    sortOrder: 0,
    ...overrides,
  }
}

const WEATHER: DigestWeather = {
  highF: 84,
  lowF: 67,
  precipitationChance: 40,
  expectedInches: 0.2,
  derivedLine: 'rain likely after 2pm',
}

function entry(overrides: Partial<DigestBookingInput> = {}): DigestBookingInput {
  return {
    booking: booking(),
    propertyNickname: 'Maple Street',
    customerName: 'Dana',
    visits: [],
    logs: [],
    instructions: [],
    weather: null,
    ...overrides,
  }
}

function build(overrides: Partial<DigestInput> = {}) {
  return buildDigestModel({ today: TODAY, bookings: [], ...overrides })
}

describe('buildDigestModel — the timeline', () => {
  it('covers every date in the service range, marked past, today, or future', () => {
    // Acceptance criterion. 2026-08-15 to 2026-08-20 with today on the 17th.
    const model = build({ bookings: [entry()] })
    const timeline = model.bookings[0]?.timeline ?? []

    expect(timeline.map((t) => t.date)).toEqual([
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ])
    expect(timeline.map((t) => t.position)).toEqual([
      'past',
      'past',
      'today',
      'future',
      'future',
      'future',
    ])
  })

  it('shows a truncated summary on a past day with a logged visit', () => {
    // Acceptance criterion.
    const note =
      'Walked the dog twice around the block, refilled both water bowls, and locked up behind me.'
    const model = build({
      bookings: [
        entry({
          visits: [visit('2026-08-15')],
          logs: [{ visitId: 'visit-2026-08-15', outcome: 'completed', note }],
        }),
      ],
    })

    const day = model.bookings[0]?.timeline[0]
    expect(day?.position).toBe('past')
    expect(day?.hasVisit).toBe(true)
    expect(day?.logged).toBe(true)
    expect(day?.outcome).toBe('completed')
    expect(day?.summary).toBe('Walked the dog twice around the block, refilled both water…')
    expect(day?.summary?.length).toBeLessThanOrEqual(61)
  })

  it('marks a past visit with no log as logged: false, with no outcome or summary', () => {
    // Acceptance criterion.
    const model = build({ bookings: [entry({ visits: [visit('2026-08-15')], logs: [] })] })
    const day = model.bookings[0]?.timeline[0]
    expect(day?.hasVisit).toBe(true)
    expect(day?.logged).toBe(false)
    expect(day?.outcome).toBeNull()
    expect(day?.summary).toBeNull()
  })

  it('marks a past day with no visit as hasVisit: false', () => {
    // Acceptance criterion.
    const model = build({ bookings: [entry({ visits: [visit('2026-08-16')] })] })
    const timeline = model.bookings[0]?.timeline ?? []
    expect(timeline[0]?.date).toBe('2026-08-15')
    expect(timeline[0]?.hasVisit).toBe(false)
    expect(timeline[1]?.hasVisit).toBe(true)
  })

  it('carries no summary and no outcome on a future day', () => {
    // Acceptance criterion. A log on a future date is data to fix, not to render.
    const model = build({
      bookings: [
        entry({
          visits: [visit('2026-08-19')],
          logs: [{ visitId: 'visit-2026-08-19', outcome: 'completed', note: 'Should not appear' }],
        }),
      ],
    })
    const future = model.bookings[0]?.timeline.find((t) => t.date === '2026-08-19')
    expect(future?.position).toBe('future')
    expect(future?.hasVisit).toBe(true)
    expect(future?.logged).toBe(false)
    expect(future?.outcome).toBeNull()
    expect(future?.summary).toBeNull()
  })

  it('reports a logged visit on today itself', () => {
    const model = build({
      bookings: [
        entry({
          visits: [visit('2026-08-17')],
          logs: [
            { visitId: 'visit-2026-08-17', outcome: 'partially_completed', note: 'Short walk' },
          ],
        }),
      ],
    })
    const day = model.bookings[0]?.timeline.find((t) => t.position === 'today')
    expect(day?.logged).toBe(true)
    expect(day?.outcome).toBe('partially_completed')
    expect(day?.summary).toBe('Short walk')
  })

  it('leaves summary null when a log has no note', () => {
    const model = build({
      bookings: [
        entry({
          visits: [visit('2026-08-15')],
          logs: [{ visitId: 'visit-2026-08-15', outcome: 'skipped', note: null }],
        }),
      ],
    })
    const day = model.bookings[0]?.timeline[0]
    expect(day?.logged).toBe(true)
    expect(day?.outcome).toBe('skipped')
    expect(day?.summary).toBeNull()
  })
})

describe('buildDigestModel — today', () => {
  it('carries the visit scheduled for today and its task labels', () => {
    const model = build({
      bookings: [
        entry({
          visits: [visit('2026-08-17', { taskIds: ['task-cat', 'task-plant'] })],
          instructions: [
            instruction({ id: 'task-cat', label: 'Feed the cat', sortOrder: 0 }),
            instruction({ id: 'task-plant', label: 'Water the plants', sortOrder: 1 }),
          ],
        }),
      ],
    })
    expect(model.bookings[0]?.todayVisit?.date).toBe('2026-08-17')
    expect(model.bookings[0]?.todayTasks).toEqual(['Feed the cat', 'Water the plants'])
  })

  it('has a null todayVisit and no tasks when nothing is scheduled today', () => {
    const model = build({ bookings: [entry({ visits: [visit('2026-08-18')] })] })
    expect(model.bookings[0]?.todayVisit).toBeNull()
    expect(model.bookings[0]?.todayTasks).toEqual([])
  })

  it('has a null todayVisit when today falls outside the service range', () => {
    const future = booking({ startDate: d('2026-09-01'), endDate: d('2026-09-05') })
    const model = build({ bookings: [entry({ booking: future })] })
    expect(model.bookings[0]?.todayVisit).toBeNull()
  })

  it('drops a task identifier with no matching instruction rather than throwing', () => {
    const model = build({
      bookings: [
        entry({
          visits: [visit('2026-08-17', { taskIds: ['task-cat', 'task-deleted'] })],
          instructions: [instruction({ id: 'task-cat', label: 'Feed the cat' })],
        }),
      ],
    })
    expect(model.bookings[0]?.todayTasks).toEqual(['Feed the cat'])
  })
})

describe('buildDigestModel — weather', () => {
  it('includes weather when at least one instruction is weather-relevant', () => {
    // Acceptance criterion.
    const model = build({
      bookings: [
        entry({
          weather: WEATHER,
          instructions: [
            instruction({ id: 'a', weatherRelevant: false, sortOrder: 0 }),
            instruction({ id: 'b', label: 'Walk the dog', weatherRelevant: true, sortOrder: 1 }),
          ],
        }),
      ],
    })
    expect(model.bookings[0]?.weather).toEqual(WEATHER)
  })

  it('omits weather when no instruction is weather-relevant, even when supplied', () => {
    // Acceptance criterion.
    const model = build({
      bookings: [
        entry({
          weather: WEATHER,
          instructions: [instruction({ weatherRelevant: false })],
        }),
      ],
    })
    expect(model.bookings[0]?.weather).toBeNull()
  })

  it('omits weather when there are no instructions at all', () => {
    const model = build({ bookings: [entry({ weather: WEATHER, instructions: [] })] })
    expect(model.bookings[0]?.weather).toBeNull()
  })

  it('is null when relevant but none was supplied', () => {
    const model = build({
      bookings: [entry({ weather: null, instructions: [instruction({ weatherRelevant: true })] })],
    })
    expect(model.bookings[0]?.weather).toBeNull()
  })
})

describe('buildDigestModel — attention items', () => {
  it('flags an unlogged visit on a past date', () => {
    // Acceptance criterion.
    const model = build({ bookings: [entry({ visits: [visit('2026-08-15')], logs: [] })] })
    const item = model.attention.find((a) => a.kind === 'unlogged_visit')
    expect(item).toBeDefined()
    expect(item?.bookingId).toBe('booking-1')
    expect(item?.href).toBe('/bookings/booking-1')
    expect(item?.label).toContain('Maple Street')
    expect(item?.label).toContain('2026-08-15')
  })

  it('does not flag a logged past visit, or a visit today or later', () => {
    const model = build({
      bookings: [
        entry({
          visits: [visit('2026-08-15'), visit('2026-08-17'), visit('2026-08-19')],
          logs: [{ visitId: 'visit-2026-08-15', outcome: 'completed', note: null }],
        }),
      ],
    })
    expect(model.attention.filter((a) => a.kind === 'unlogged_visit')).toHaveLength(0)
  })

  it('flags a booking missing datesFirmAt', () => {
    // Acceptance criterion.
    const model = build({ bookings: [entry({ booking: booking({ datesFirmAt: null }) })] })
    const item = model.attention.find((a) => a.kind === 'missing_dates_firm')
    expect(item).toBeDefined()
    expect(item?.label).toContain('Dana')
    expect(item?.href).toBe('/bookings/booking-1')
  })

  it('flags a booking missing availabilityCheckedAt', () => {
    // Acceptance criterion.
    const model = build({
      bookings: [entry({ booking: booking({ availabilityCheckedAt: null }) })],
    })
    const item = model.attention.find((a) => a.kind === 'missing_availability_check')
    expect(item).toBeDefined()
    expect(item?.label).toMatch(/family calendar/i)
  })

  it('flags an unconfirmed booking starting within 7 days', () => {
    // Acceptance criterion. Starts in 5 days, availability never checked.
    const soon = booking({
      startDate: d('2026-08-22'),
      endDate: d('2026-08-25'),
      availabilityCheckedAt: null,
    })
    const model = build({ bookings: [entry({ booking: soon })] })
    const item = model.attention.find((a) => a.kind === 'starts_soon_unconfirmed')
    expect(item).toBeDefined()
    expect(item?.label).toContain('5 days')
  })

  it('does not flag starts_soon when the booking is confirmed', () => {
    const soonConfirmed = booking({ startDate: d('2026-08-22'), endDate: d('2026-08-25') })
    const model = build({ bookings: [entry({ booking: soonConfirmed })] })
    expect(model.attention.filter((a) => a.kind === 'starts_soon_unconfirmed')).toHaveLength(0)
  })

  it('does not flag starts_soon when the start is more than 7 days out', () => {
    const far = booking({
      startDate: d('2026-09-01'),
      endDate: d('2026-09-05'),
      availabilityCheckedAt: null,
    })
    const model = build({ bookings: [entry({ booking: far })] })
    expect(model.attention.filter((a) => a.kind === 'starts_soon_unconfirmed')).toHaveLength(0)
  })

  it('uses singular and today-specific wording at the boundaries', () => {
    const tomorrow = booking({
      startDate: d('2026-08-18'),
      endDate: d('2026-08-20'),
      availabilityCheckedAt: null,
    })
    const startsToday = booking({
      startDate: TODAY,
      endDate: d('2026-08-20'),
      availabilityCheckedAt: null,
    })
    const one = build({ bookings: [entry({ booking: tomorrow })] })
    const zero = build({ bookings: [entry({ booking: startsToday })] })

    expect(one.attention.find((a) => a.kind === 'starts_soon_unconfirmed')?.label).toContain(
      '1 day'
    )
    expect(zero.attention.find((a) => a.kind === 'starts_soon_unconfirmed')?.label).toContain(
      'starts today'
    )
  })

  it('flags exactly at the 7 day boundary but not at 8', () => {
    const atSeven = booking({
      startDate: d('2026-08-24'),
      endDate: d('2026-08-26'),
      availabilityCheckedAt: null,
    })
    const atEight = booking({
      startDate: d('2026-08-25'),
      endDate: d('2026-08-27'),
      availabilityCheckedAt: null,
    })
    expect(
      build({ bookings: [entry({ booking: atSeven })] }).attention.some(
        (a) => a.kind === 'starts_soon_unconfirmed'
      )
    ).toBe(true)
    expect(
      build({ bookings: [entry({ booking: atEight })] }).attention.some(
        (a) => a.kind === 'starts_soon_unconfirmed'
      )
    ).toBe(false)
  })

  it('reports several kinds at once on one booking', () => {
    const messy = booking({
      startDate: d('2026-08-15'),
      endDate: d('2026-08-20'),
      datesFirmAt: null,
      availabilityCheckedAt: null,
    })
    const model = build({ bookings: [entry({ booking: messy, visits: [visit('2026-08-15')] })] })
    expect(model.attention.map((a) => a.kind).sort()).toEqual([
      'missing_availability_check',
      'missing_dates_firm',
      'unlogged_visit',
    ])
  })

  it('writes no placeholder copy in any label', () => {
    const messy = booking({ datesFirmAt: null, availabilityCheckedAt: null })
    const model = build({ bookings: [entry({ booking: messy, visits: [visit('2026-08-15')] })] })
    for (const item of model.attention) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.label).not.toMatch(/lorem|ipsum|tbd|todo|coming soon|undefined|null/i)
    }
  })
})

describe('buildDigestModel — a booking with no dates', () => {
  it('produces attention items but no block', () => {
    const inquiry = booking({ startDate: null, endDate: null, datesFirmAt: null })
    const model = build({ bookings: [entry({ booking: inquiry })] })
    expect(model.bookings).toHaveLength(0)
    expect(model.attention.some((a) => a.kind === 'missing_dates_firm')).toBe(true)
  })

  it('produces no block when only the end date is missing', () => {
    const half = booking({ endDate: null })
    const model = build({ bookings: [entry({ booking: half })] })
    expect(model.bookings).toHaveLength(0)
  })
})

describe('buildDigestModel — isEmpty', () => {
  it('is true with no bookings and no attention items', () => {
    // Acceptance criterion.
    const model = build({ bookings: [] })
    expect(model.bookings).toEqual([])
    expect(model.attention).toEqual([])
    expect(model.isEmpty).toBe(true)
  })

  it('is false with no bookings but one attention item', () => {
    // Acceptance criterion. Reachable because an undated booking yields
    // attention items and no block.
    const inquiry = booking({ startDate: null, endDate: null, datesFirmAt: null })
    const model = build({ bookings: [entry({ booking: inquiry })] })
    expect(model.bookings).toHaveLength(0)
    expect(model.attention.length).toBeGreaterThan(0)
    expect(model.isEmpty).toBe(false)
  })

  it('is false with a booking and no attention items', () => {
    const model = build({ bookings: [entry()] })
    expect(model.attention).toEqual([])
    expect(model.isEmpty).toBe(false)
  })

  it('carries today as its date', () => {
    expect(build().date).toBe(TODAY)
  })
})

describe('buildDigestModel — several bookings', () => {
  it('keeps blocks in the order given and gathers all attention items', () => {
    const second = booking({ id: 'booking-2', availabilityCheckedAt: null })
    const model = build({
      bookings: [
        entry(),
        entry({ booking: second, propertyNickname: 'Oak Lane', customerName: 'Sam' }),
      ],
    })
    expect(model.bookings.map((b) => b.bookingId)).toEqual(['booking-1', 'booking-2'])
    expect(model.attention.map((a) => a.bookingId)).toEqual(['booking-2'])
    expect(model.attention[0]?.href).toBe('/bookings/booking-2')
  })
})

describe('buildDigestModel — purity', () => {
  it('takes today as an argument and reads no clock', () => {
    // Acceptance criterion. The same booking yields different positions on
    // different days, decided only by the argument.
    const onFifteenth = buildDigestModel({ today: d('2026-08-15'), bookings: [entry()] })
    const onTwentieth = buildDigestModel({ today: d('2026-08-20'), bookings: [entry()] })
    expect(onFifteenth.bookings[0]?.timeline[0]?.position).toBe('today')
    expect(onTwentieth.bookings[0]?.timeline[0]?.position).toBe('past')
  })

  it('does not touch the clock or randomness', () => {
    const dateCtor = globalThis.Date as unknown as { now: () => number }
    const mathObj = globalThis.Math as unknown as { random: () => number }
    const realNow = dateCtor.now
    const realRandom = mathObj.random
    dateCtor.now = () => {
      throw new Error('src/core/digest.ts read the clock')
    }
    mathObj.random = () => {
      throw new Error('src/core/digest.ts read a random source')
    }
    try {
      expect(build({ bookings: [entry()] }).isEmpty).toBe(false)
    } finally {
      dateCtor.now = realNow
      mathObj.random = realRandom
    }
  })

  it('does not mutate its input', () => {
    const given: DigestInput = {
      today: TODAY,
      bookings: [entry({ visits: [visit('2026-08-15')] })],
    }
    const before = JSON.stringify(given)
    buildDigestModel(given)
    expect(JSON.stringify(given)).toBe(before)
  })

  it('produces no HTML and no subject line', () => {
    const model = build({ bookings: [entry()] })
    expect(Object.keys(model).sort()).toEqual(['attention', 'bookings', 'date', 'isEmpty'])
    expect(JSON.stringify(model)).not.toMatch(/<[a-z]/i)
  })
})
