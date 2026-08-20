/**
 * Visit generation, regeneration, and editing.
 *
 * `generateVisits` in `src/core/schedule.ts` is the ONLY scheduler. Nothing
 * here re-expands a cadence; this module turns that pure result into rows,
 * and decides what happens to rows that already exist — which is the part
 * Phase 0 deliberately left to the service layer.
 *
 * A NOTE ON ATTRIBUTION. `visits` has no `created_by` column in
 * `docs/dev-plan.md` §5, unlike `bookings`, `visit_logs`, and `photos`. So a
 * visit write is attributed through the activity log rather than on the row.
 * Adding a column would be a schema change the plan does not call for;
 * recorded rather than done.
 */

import { generateVisits as generateFromCadence } from '@/core/schedule'
import { deriveStatus } from '@/core/status'
import type { CalendarDate, CareInstruction, TimeWindow } from '@/core/types'

import { createActivityEntry } from '@/db/repositories/activity'
import { getBooking } from '@/db/repositories/bookings'
import {
  createVisit,
  deleteVisits,
  listVisitsForBooking,
  setVisitTasks,
  updateVisit,
} from '@/db/repositories/visits'
import { listVisitLogsForVisits } from '@/db/repositories/visit-logs'
import type { Visit } from '@/db/repositories/visits'

import { effectiveInstructionsForBooking } from './care-instructions'
import { toBookingCore } from './home'

export class VisitError extends Error {}

export interface SkippedInstruction {
  id: string
  label: string
  reason: string
}

/**
 * What a regeneration would do, before it does it.
 *
 * `docs/user-journeys.md` step 4.3.4 requires a warning that NAMES the logged
 * visits at stake before regenerating. Computing the plan separately from
 * applying it is what makes that warning truthful rather than a guess.
 */
export interface RegenerationPlan {
  /** Dates the cadences produce that have no visit yet. */
  toCreate: CalendarDate[]
  /** Existing unlogged visits whose date the cadences no longer produce. */
  toDelete: Visit[]
  /** Logged visits the cadences no longer produce. NEVER deleted. */
  preservedLogged: Visit[]
  skipped: SkippedInstruction[]
}

function instructionsToCore(
  effective: Awaited<ReturnType<typeof effectiveInstructionsForBooking>>
): CareInstruction[] {
  return effective.map((e) => ({
    id: e.instruction.id,
    label: e.instruction.label,
    detail: e.instruction.detail,
    cadence: e.instruction.cadence,
    cadenceCustom: e.instruction.cadenceCustom,
    weatherRelevant: e.instruction.weatherRelevant,
    sortOrder: e.instruction.sortOrder,
  }))
}

export async function planRegeneration(
  businessId: string,
  bookingId: string
): Promise<RegenerationPlan> {
  const booking = await getBooking(businessId, bookingId)
  if (booking === null) throw new VisitError('That booking no longer exists.')
  if (booking.startDate === null || booking.endDate === null) {
    throw new VisitError('A booking needs both dates before visits can be generated.')
  }

  const effective = await effectiveInstructionsForBooking(businessId, booking.propertyId, bookingId)
  const instructions = instructionsToCore(effective)

  const result = generateFromCadence({
    startDate: booking.startDate as CalendarDate,
    endDate: booking.endDate as CalendarDate,
    instructions,
  })

  const generatedDates = new Set(result.visits.map((v) => v.date))
  const existing = await listVisitsForBooking(businessId, bookingId)
  const logs = await listVisitLogsForVisits(
    businessId,
    existing.map((v) => v.id)
  )
  const logged = new Set(logs.map((l) => l.visitId))

  const existingDates = new Set(existing.map((v) => v.visitDate))
  const stale = existing.filter((v) => !generatedDates.has(v.visitDate as CalendarDate))

  const labelById = new Map(instructions.map((i) => [i.id, i.label]))

  return {
    toCreate: result.visits.map((v) => v.date).filter((d) => !existingDates.has(d)),
    toDelete: stale.filter((v) => !logged.has(v.id)),
    preservedLogged: stale.filter((v) => logged.has(v.id)),
    skipped: result.skippedInstructions.map((s) => ({
      id: s.id,
      label: labelById.get(s.id) ?? s.id,
      reason: s.reason,
    })),
  }
}

/**
 * Generate or regenerate the visit schedule.
 *
 * PRESERVES LOGGED VISITS ALWAYS. A visit someone has written up records what
 * actually happened; a cadence change must not be able to erase it. Unlogged
 * visits the cadences no longer produce are removed.
 */
export async function regenerateVisitsForBooking(
  businessId: string,
  actingAdminId: string,
  actingAdminName: string,
  bookingId: string,
  today: CalendarDate,
  options: { recordActivity?: boolean } = {}
): Promise<RegenerationPlan> {
  const booking = await getBooking(businessId, bookingId)
  if (booking === null) throw new VisitError('That booking no longer exists.')
  if (booking.startDate === null || booking.endDate === null) {
    throw new VisitError('A booking needs both dates before visits can be generated.')
  }

  const effective = await effectiveInstructionsForBooking(businessId, booking.propertyId, bookingId)
  const instructions = instructionsToCore(effective)

  // Computed ONCE and reused. An earlier version called planRegeneration and
  // then repeated the booking read, the instruction resolution, and the
  // schedule expansion — three extra round trips per regeneration, which was
  // enough to time a test out against a remote database.
  const generated = generateFromCadence({
    startDate: booking.startDate as CalendarDate,
    endDate: booking.endDate as CalendarDate,
    instructions,
  })

  const generatedDates = new Set(generated.visits.map((v) => v.date))
  const existing = await listVisitsForBooking(businessId, bookingId)
  const logs = await listVisitLogsForVisits(
    businessId,
    existing.map((v) => v.id)
  )
  const logged = new Set(logs.map((l) => l.visitId))
  const existingDates = new Set(existing.map((v) => v.visitDate))
  const stale = existing.filter((v) => !generatedDates.has(v.visitDate as CalendarDate))
  const labelById = new Map(instructions.map((i) => [i.id, i.label]))

  const plan: RegenerationPlan = {
    toCreate: generated.visits.map((v) => v.date).filter((d) => !existingDates.has(d)),
    toDelete: stale.filter((v) => !logged.has(v.id)),
    preservedLogged: stale.filter((v) => logged.has(v.id)),
    skipped: generated.skippedInstructions.map((s) => ({
      id: s.id,
      label: labelById.get(s.id) ?? s.id,
      reason: s.reason,
    })),
  }

  if (plan.toDelete.length > 0) {
    await deleteVisits(
      businessId,
      plan.toDelete.map((v) => v.id)
    )
  }

  const byDate = new Map(existing.map((v) => [v.visitDate, v]))
  for (const wanted of generated.visits) {
    const row =
      byDate.get(wanted.date) ??
      (await createVisit(businessId, { bookingId, visitDate: wanted.date }))
    // A date carrying two instructions is ONE visit with both tasks.
    await setVisitTasks(businessId, row.id, wanted.taskIds)
  }

  if (options.recordActivity !== false) {
    await createActivityEntry(businessId, {
      bookingId,
      note: `${actingAdminName} regenerated the visits.`,
      source: 'app',
      entryDate: today,
      actorId: actingAdminId,
      isSystem: true,
    })
  }

  return plan
}

/**
 * Generate visits when a booking becomes confirmed.
 *
 * Keys off the RESULTING derived status rather than off which flag was
 * toggled, because either of the two confirmation actions can be the one that
 * completes it. Does nothing when the booking already has visits, so a flag
 * toggled off and on again does not rebuild a schedule someone has edited.
 */
export async function generateVisitsOnConfirmation(
  businessId: string,
  actingAdminId: string,
  actingAdminName: string,
  bookingId: string,
  today: CalendarDate
): Promise<void> {
  const booking = await getBooking(businessId, bookingId)
  if (booking === null) return
  if (booking.startDate === null || booking.endDate === null) return

  const status = deriveStatus(toBookingCore(booking), today)
  if (status !== 'confirmed' && status !== 'in_progress') return

  const existing = await listVisitsForBooking(businessId, bookingId)
  if (existing.length > 0) return

  await regenerateVisitsForBooking(businessId, actingAdminId, actingAdminName, bookingId, today, {
    recordActivity: false,
  })
}

// ── Individual visit editing ─────────────────────────────────────────

export async function addVisit(
  businessId: string,
  bookingId: string,
  visitDate: CalendarDate,
  window: TimeWindow,
  durationMinutes: number | null
): Promise<Visit> {
  const existing = await listVisitsForBooking(businessId, bookingId)
  if (existing.some((v) => v.visitDate === visitDate)) {
    throw new VisitError('There is already a visit on that date.')
  }
  return createVisit(businessId, { bookingId, visitDate, window, durationMinutes })
}

export async function editVisit(
  businessId: string,
  visitId: string,
  patch: { window?: TimeWindow; durationMinutes?: number | null }
): Promise<void> {
  await updateVisit(businessId, visitId, patch)
}

/** True when this visit has been written up, and so needs a confirmation to delete. */
export async function visitHasLog(businessId: string, visitId: string): Promise<boolean> {
  const logs = await listVisitLogsForVisits(businessId, [visitId])
  return logs.length > 0
}

/**
 * Delete a visit.
 *
 * A visit with a log requires `confirmed: true` — journey step 4.3.3. An
 * unlogged upcoming visit deletes without ceremony, step 4.3.2.
 */
export async function removeVisit(
  businessId: string,
  visitId: string,
  confirmed: boolean
): Promise<void> {
  if ((await visitHasLog(businessId, visitId)) && !confirmed) {
    throw new VisitError('That visit has a log. Confirm to delete it.')
  }
  await deleteVisits(businessId, [visitId])
}
