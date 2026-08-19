/**
 * Visit schedule generation.
 *
 * PURE. No clock, no environment, no input or output.
 *
 * Turns a service range and a set of care instructions into dated visits.
 * Offsets are counted in DAYS FROM THE START DATE, INCLUSIVE, so offset 0 is
 * the first day of the range. Two instructions landing on the same date
 * produce ONE visit carrying both task identifiers, because the sitter makes
 * one trip and does both things.
 */

import { addDays, compareDates, daysBetween } from './dates'
import type {
  CalendarDate,
  Cadence,
  CareInstruction,
  GeneratedVisit,
  ScheduleResult,
} from './types'

export interface ScheduleInput {
  startDate: CalendarDate
  endDate: CalendarDate
  instructions: readonly CareInstruction[]
}

/**
 * How often a stepping cadence recurs, in days.
 *
 * The three stepping cadences differ only by this number, so they are one
 * branch rather than three. The cadences that do not step are handled
 * separately below and are absent here on purpose.
 */
const STEP_BY_CADENCE: Partial<Record<Cadence, number>> = {
  every_day: 1,
  every_other_day: 2,
  every_third_day: 3,
}

/**
 * Why a cadence generates nothing.
 *
 * These two are not failures. They mean the sitter decides when to go, and
 * the visits are added by hand. They are reported rather than silently
 * dropped so that a surface can say so instead of leaving someone wondering
 * why their instruction produced no visits.
 */
const SKIP_REASON: Partial<Record<Cadence, string>> = {
  as_needed: 'Cadence is as needed, so visits are added by hand rather than generated.',
  custom: 'Cadence is custom, so visits are added by hand rather than generated.',
}

/** The day offsets an instruction produces within a range of `dayCount` days. */
function offsetsFor(cadence: Cadence, dayCount: number): number[] {
  if (dayCount <= 0) return []

  const step = STEP_BY_CADENCE[cadence]
  if (step !== undefined) {
    const offsets: number[] = []
    for (let offset = 0; offset < dayCount; offset += step) offsets.push(offset)
    return offsets
  }

  if (cadence === 'once_at_start') return [0]
  if (cadence === 'once_at_end') return [dayCount - 1]

  // as_needed and custom: the sitter decides when to go, so nothing is
  // generated. The caller records why alongside the empty result.
  return []
}

/**
 * Generate the visits a set of care instructions implies over a service range.
 *
 * Instructions are processed in `sortOrder`, so the task identifiers on a
 * collapsed visit read in the same order the instructions do on screen.
 *
 * Returns visits sorted ascending by date with no duplicate dates, and the
 * instructions that generated nothing along with why.
 *
 * An inverted range — end before start — yields no visits rather than
 * throwing, matching expandRange. A booking whose dates have not been
 * settled is a normal state, not an error.
 */
export function generateVisits(input: ScheduleInput): ScheduleResult {
  const { startDate, endDate, instructions } = input

  const dayCount = daysBetween(startDate, endDate)

  // Keyed by date so instructions landing on the same day collapse into one
  // visit. Insertion order does not matter; the result is sorted below.
  const taskIdsByDate = new Map<CalendarDate, string[]>()
  const skippedInstructions: { id: string; reason: string }[] = []

  const ordered = [...instructions].sort((a, b) => a.sortOrder - b.sortOrder)

  for (const instruction of ordered) {
    const reason = SKIP_REASON[instruction.cadence]
    if (reason !== undefined) skippedInstructions.push({ id: instruction.id, reason })

    // Not an early continue: a skipped cadence simply yields no offsets, so
    // one path covers every cadence and there is no unreachable branch.
    for (const offset of offsetsFor(instruction.cadence, dayCount)) {
      const date = addDays(startDate, offset)
      const existing = taskIdsByDate.get(date)
      if (existing === undefined) {
        taskIdsByDate.set(date, [instruction.id])
      } else {
        existing.push(instruction.id)
      }
    }
  }

  const visits: GeneratedVisit[] = [...taskIdsByDate.entries()]
    .map(([date, taskIds]) => ({ date, taskIds }))
    .sort((a, b) => compareDates(a.date, b.date))

  return { visits, skippedInstructions }
}
