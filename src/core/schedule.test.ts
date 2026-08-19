import { describe, it, expect } from 'vitest'
import { generateVisits } from './schedule'
import type { ScheduleInput } from './schedule'
import { toCalendarDate } from './dates'
import type { Cadence, CareInstruction } from './types'

const d = toCalendarDate

// 2026-08-01 through 2026-08-07 is 7 days; through 2026-08-08 is 8.
const START = d('2026-08-01')
const END_7 = d('2026-08-07')
const END_8 = d('2026-08-08')

function instruction(overrides: Partial<CareInstruction> = {}): CareInstruction {
  return {
    id: 'task-1',
    label: 'Feed the cat',
    detail: null,
    cadence: 'every_day',
    cadenceCustom: null,
    weatherRelevant: false,
    sortOrder: 0,
    ...overrides,
  }
}

function run(cadence: Cadence, endDate = END_7, overrides: Partial<ScheduleInput> = {}) {
  return generateVisits({
    startDate: START,
    endDate,
    instructions: [instruction({ cadence })],
    ...overrides,
  })
}

describe('generateVisits — one test per row of the cadence anchoring table', () => {
  it('every_day over a 7 day range produces 7 visits', () => {
    // Acceptance criterion.
    const result = run('every_day')
    expect(result.visits).toHaveLength(7)
    expect(result.visits.map((v) => v.date)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ])
  })

  it('every_other_day over an 8 day range produces 4 visits on offsets 0, 2, 4, 6', () => {
    // Acceptance criterion.
    const result = run('every_other_day', END_8)
    expect(result.visits).toHaveLength(4)
    expect(result.visits.map((v) => v.date)).toEqual([
      '2026-08-01',
      '2026-08-03',
      '2026-08-05',
      '2026-08-07',
    ])
  })

  it('every_other_day over a 7 day range also produces 4 visits on offsets 0, 2, 4, 6', () => {
    // Acceptance criterion. The 7 and 8 day ranges agree because offset 6 is
    // the last that fits in either; the 8th day gets no visit.
    const result = run('every_other_day', END_7)
    expect(result.visits).toHaveLength(4)
    expect(result.visits.map((v) => v.date)).toEqual([
      '2026-08-01',
      '2026-08-03',
      '2026-08-05',
      '2026-08-07',
    ])
  })

  it('every_third_day over a 7 day range produces 3 visits on offsets 0, 3, 6', () => {
    // Acceptance criterion.
    const result = run('every_third_day')
    expect(result.visits).toHaveLength(3)
    expect(result.visits.map((v) => v.date)).toEqual(['2026-08-01', '2026-08-04', '2026-08-07'])
  })

  it('once_at_start produces exactly one visit on the start date', () => {
    // Acceptance criterion.
    const result = run('once_at_start')
    expect(result.visits).toHaveLength(1)
    expect(result.visits[0]?.date).toBe('2026-08-01')
  })

  it('once_at_end produces exactly one visit on the end date', () => {
    // Acceptance criterion.
    const result = run('once_at_end')
    expect(result.visits).toHaveLength(1)
    expect(result.visits[0]?.date).toBe('2026-08-07')
  })

  it('as_needed produces no visits and is reported with a reason', () => {
    // Acceptance criterion.
    const result = run('as_needed')
    expect(result.visits).toHaveLength(0)
    expect(result.skippedInstructions).toHaveLength(1)
    expect(result.skippedInstructions[0]?.id).toBe('task-1')
    expect(result.skippedInstructions[0]?.reason).toMatch(/as needed/i)
    expect(result.skippedInstructions[0]?.reason.length).toBeGreaterThan(10)
  })

  it('custom produces no visits and is reported with a reason', () => {
    // Acceptance criterion.
    const result = run('custom')
    expect(result.visits).toHaveLength(0)
    expect(result.skippedInstructions).toHaveLength(1)
    expect(result.skippedInstructions[0]?.id).toBe('task-1')
    expect(result.skippedInstructions[0]?.reason).toMatch(/custom/i)
  })

  it('a generating cadence is never reported as skipped', () => {
    for (const cadence of [
      'every_day',
      'every_other_day',
      'every_third_day',
      'once_at_start',
      'once_at_end',
    ] as Cadence[]) {
      expect(run(cadence).skippedInstructions).toEqual([])
    }
  })
})

describe('generateVisits — collapsing instructions onto one visit', () => {
  it('a daily cat and an every-other-day plant over 7 days give 7 visits, 4 with both tasks', () => {
    // Acceptance criterion, stated exactly.
    const result = generateVisits({
      startDate: START,
      endDate: END_7,
      instructions: [
        instruction({ id: 'cat', label: 'Feed the cat', cadence: 'every_day', sortOrder: 0 }),
        instruction({
          id: 'plant',
          label: 'Water the plants',
          cadence: 'every_other_day',
          sortOrder: 1,
        }),
      ],
    })

    expect(result.visits).toHaveLength(7)

    const withBoth = result.visits.filter((v) => v.taskIds.length === 2)
    const withOne = result.visits.filter((v) => v.taskIds.length === 1)
    expect(withBoth).toHaveLength(4)
    expect(withOne).toHaveLength(3)

    expect(withBoth.map((v) => v.date)).toEqual([
      '2026-08-01',
      '2026-08-03',
      '2026-08-05',
      '2026-08-07',
    ])
    expect(withOne.map((v) => v.date)).toEqual(['2026-08-02', '2026-08-04', '2026-08-06'])
    for (const v of withBoth) expect(v.taskIds).toEqual(['cat', 'plant'])
    for (const v of withOne) expect(v.taskIds).toEqual(['cat'])
  })

  it('a single-day range with once_at_start and once_at_end gives one visit with both tasks', () => {
    // Acceptance criterion. Both cadences resolve to offset 0.
    const result = generateVisits({
      startDate: START,
      endDate: START,
      instructions: [
        instruction({ id: 'arrive', cadence: 'once_at_start', sortOrder: 0 }),
        instruction({ id: 'depart', cadence: 'once_at_end', sortOrder: 1 }),
      ],
    })

    expect(result.visits).toHaveLength(1)
    expect(result.visits[0]?.date).toBe('2026-08-01')
    expect(result.visits[0]?.taskIds).toEqual(['arrive', 'depart'])
  })

  it('orders task identifiers by the instructions sortOrder, not by input order', () => {
    const result = generateVisits({
      startDate: START,
      endDate: START,
      instructions: [
        instruction({ id: 'third', cadence: 'every_day', sortOrder: 2 }),
        instruction({ id: 'first', cadence: 'every_day', sortOrder: 0 }),
        instruction({ id: 'second', cadence: 'every_day', sortOrder: 1 }),
      ],
    })
    expect(result.visits[0]?.taskIds).toEqual(['first', 'second', 'third'])
  })

  it('collapses three cadences landing on the start date', () => {
    const result = generateVisits({
      startDate: START,
      endDate: END_7,
      instructions: [
        instruction({ id: 'a', cadence: 'every_day', sortOrder: 0 }),
        instruction({ id: 'b', cadence: 'every_other_day', sortOrder: 1 }),
        instruction({ id: 'c', cadence: 'once_at_start', sortOrder: 2 }),
      ],
    })
    expect(result.visits[0]?.date).toBe('2026-08-01')
    expect(result.visits[0]?.taskIds).toEqual(['a', 'b', 'c'])
  })
})

describe('generateVisits — shape of the result', () => {
  it('returns visits sorted ascending with no duplicate dates', () => {
    // Acceptance criterion.
    const result = generateVisits({
      startDate: START,
      endDate: END_8,
      instructions: [
        instruction({ id: 'end', cadence: 'once_at_end', sortOrder: 3 }),
        instruction({ id: 'third', cadence: 'every_third_day', sortOrder: 2 }),
        instruction({ id: 'other', cadence: 'every_other_day', sortOrder: 1 }),
        instruction({ id: 'daily', cadence: 'every_day', sortOrder: 0 }),
      ],
    })

    const dates = result.visits.map((v) => v.date)
    expect(new Set(dates).size).toBe(dates.length)
    expect([...dates].sort()).toEqual(dates)
    expect(dates).toHaveLength(8)
  })

  it('an empty instruction list produces zero visits and does not throw', () => {
    // Acceptance criterion.
    const result = generateVisits({ startDate: START, endDate: END_7, instructions: [] })
    expect(result.visits).toEqual([])
    expect(result.skippedInstructions).toEqual([])
  })

  it('mixes generated visits and skipped instructions in one result', () => {
    const result = generateVisits({
      startDate: START,
      endDate: END_7,
      instructions: [
        instruction({ id: 'daily', cadence: 'every_day', sortOrder: 0 }),
        instruction({ id: 'adhoc', cadence: 'as_needed', sortOrder: 1 }),
        instruction({ id: 'bespoke', cadence: 'custom', sortOrder: 2 }),
      ],
    })
    expect(result.visits).toHaveLength(7)
    expect(result.skippedInstructions.map((s) => s.id)).toEqual(['adhoc', 'bespoke'])
    for (const v of result.visits) expect(v.taskIds).toEqual(['daily'])
  })

  it('yields no visits for an inverted range rather than throwing', () => {
    const result = generateVisits({
      startDate: END_7,
      endDate: START,
      instructions: [instruction({ cadence: 'every_day' })],
    })
    expect(result.visits).toEqual([])
  })

  it('does not mutate the instructions array it was given', () => {
    const given = [instruction({ id: 'b', sortOrder: 1 }), instruction({ id: 'a', sortOrder: 0 })]
    const before = given.map((i) => i.id)
    generateVisits({ startDate: START, endDate: END_7, instructions: given })
    expect(given.map((i) => i.id)).toEqual(before)
  })

  it('assigns no time window — that is the service layer', () => {
    const result = generateVisits({
      startDate: START,
      endDate: START,
      instructions: [instruction()],
    })
    expect(Object.keys(result.visits[0] ?? {}).sort()).toEqual(['date', 'taskIds'])
  })
})

describe('generateVisits — longer ranges and boundaries', () => {
  it('steps correctly across a month boundary', () => {
    const result = generateVisits({
      startDate: d('2026-08-30'),
      endDate: d('2026-09-02'),
      instructions: [instruction({ cadence: 'every_other_day' })],
    })
    expect(result.visits.map((v) => v.date)).toEqual(['2026-08-30', '2026-09-01'])
  })

  it('steps correctly across the spring daylight saving change', () => {
    // 2026-03-08 is spring-forward in America/New_York. Offsets are day
    // counts, not durations, so nothing shifts.
    const result = generateVisits({
      startDate: d('2026-03-07'),
      endDate: d('2026-03-10'),
      instructions: [instruction({ cadence: 'every_day' })],
    })
    expect(result.visits.map((v) => v.date)).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ])
  })

  it('once_at_end lands on the true last day of a long range', () => {
    const result = generateVisits({
      startDate: d('2026-08-01'),
      endDate: d('2026-09-15'),
      instructions: [instruction({ cadence: 'once_at_end' })],
    })
    expect(result.visits).toHaveLength(1)
    expect(result.visits[0]?.date).toBe('2026-09-15')
  })

  it('every_third_day over 10 days produces offsets 0, 3, 6, 9', () => {
    const result = generateVisits({
      startDate: START,
      endDate: d('2026-08-10'),
      instructions: [instruction({ cadence: 'every_third_day' })],
    })
    expect(result.visits.map((v) => v.date)).toEqual([
      '2026-08-01',
      '2026-08-04',
      '2026-08-07',
      '2026-08-10',
    ])
  })
})

describe('generateVisits — purity', () => {
  it('does not touch the clock or randomness', () => {
    const dateCtor = globalThis.Date as unknown as { now: () => number }
    const mathObj = globalThis.Math as unknown as { random: () => number }
    const realNow = dateCtor.now
    const realRandom = mathObj.random
    dateCtor.now = () => {
      throw new Error('src/core/schedule.ts read the clock')
    }
    mathObj.random = () => {
      throw new Error('src/core/schedule.ts read a random source')
    }
    try {
      expect(run('every_day').visits).toHaveLength(7)
    } finally {
      dateCtor.now = realNow
      mathObj.random = realRandom
    }
  })
})
