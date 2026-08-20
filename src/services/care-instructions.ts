/**
 * Care instruction orchestration, including booking-level overrides.
 *
 * An instruction belongs to a property or to a booking, never both — the
 * `one_owner` check constraint enforces it. A property instruction is the
 * standing arrangement; a booking instruction is a change for one engagement
 * that must not alter the property's own record.
 *
 * NOTE ON PLACEMENT. `resolveEffectiveInstructions` is a pure function and
 * would sit naturally in `src/core/`. It is here because `tasks/phase-2.md`
 * states that nothing under `src/core/` is modified in this phase — that
 * layer is complete and consumed, not extended. If a later phase needs this
 * rule outside the service layer, moving it into `src/core/` is the right
 * change, and it is already written as a pure function so the move is free.
 */

import type { CareInstructionRow } from '@/db/repositories/care-instructions'
import {
  createCareInstruction,
  deleteCareInstruction as deleteRow,
  listCareInstructionsForBooking,
  listCareInstructionsForProperty,
  updateCareInstruction as updateRow,
} from '@/db/repositories/care-instructions'

export interface EffectiveInstruction {
  instruction: CareInstructionRow
  /** True when this is a booking-level override rather than the property's. */
  isOverride: boolean
  /** Set when this override shadows a property instruction of the same label. */
  shadows: CareInstructionRow | null
}

/**
 * The instructions in force for one booking.
 *
 * A booking-level instruction SHADOWS the property instruction of the same
 * label rather than appearing beside it — otherwise the sitter reads two
 * conflicting instructions for the same task and has to guess which wins.
 * Matching is case-insensitive and trimmed, because "Cats" and "cats " are
 * the same instruction to everyone except a string comparison.
 */
export function resolveEffectiveInstructions(
  propertyInstructions: readonly CareInstructionRow[],
  bookingInstructions: readonly CareInstructionRow[]
): EffectiveInstruction[] {
  const key = (label: string) => label.trim().toLowerCase()
  const overridden = new Map(bookingInstructions.map((i) => [key(i.label), i]))

  const overrides: EffectiveInstruction[] = bookingInstructions.map((instruction) => ({
    instruction,
    isOverride: true,
    shadows: propertyInstructions.find((p) => key(p.label) === key(instruction.label)) ?? null,
  }))

  const inherited: EffectiveInstruction[] = propertyInstructions
    .filter((p) => !overridden.has(key(p.label)))
    .map((instruction) => ({ instruction, isOverride: false, shadows: null }))

  return [...inherited, ...overrides].sort(
    (a, b) => a.instruction.sortOrder - b.instruction.sortOrder
  )
}

export async function effectiveInstructionsForBooking(
  businessId: string,
  propertyId: string,
  bookingId: string
): Promise<EffectiveInstruction[]> {
  const [property, booking] = await Promise.all([
    listCareInstructionsForProperty(businessId, propertyId),
    listCareInstructionsForBooking(businessId, bookingId),
  ])
  return resolveEffectiveInstructions(property, booking)
}

export interface UpsertInstructionInput {
  id: string | null
  label: string
  detail: string | null
  cadence: CareInstructionRow['cadence']
  cadenceCustom: string | null
  weatherRelevant: boolean
  sortOrder: number
  /** True writes a booking-level override; false writes to the property. */
  bookingOnly: boolean
  propertyId: string
  bookingId: string
}

export class CareInstructionError extends Error {}

/**
 * Create or update an instruction.
 *
 * Ownership is decided by `bookingOnly` and is deliberately not editable in
 * place: an instruction cannot be moved between a property and a booking by
 * updating it, because doing so silently changes a standing arrangement into
 * a one-off or the reverse. Editing the toggle deletes and recreates, which
 * is visible.
 */
export async function upsertCareInstruction(
  businessId: string,
  input: UpsertInstructionInput
): Promise<CareInstructionRow> {
  const label = input.label.trim()
  if (label.length === 0) throw new CareInstructionError('An instruction needs a label.')
  if (input.cadence === 'custom' && (input.cadenceCustom ?? '').trim().length === 0) {
    throw new CareInstructionError('A custom cadence needs a description.')
  }

  const values = {
    label,
    detail: input.detail === null || input.detail.trim() === '' ? null : input.detail.trim(),
    cadence: input.cadence,
    cadenceCustom: input.cadence === 'custom' ? (input.cadenceCustom ?? '').trim() : null,
    weatherRelevant: input.weatherRelevant,
    sortOrder: input.sortOrder,
    propertyId: input.bookingOnly ? null : input.propertyId,
    bookingId: input.bookingOnly ? input.bookingId : null,
  }

  if (input.id !== null && input.id.length > 0) {
    const row = await updateRow(businessId, input.id, values)
    if (row === null) throw new CareInstructionError('That instruction no longer exists.')
    return row
  }

  return createCareInstruction(businessId, values)
}

export async function removeCareInstruction(businessId: string, id: string): Promise<boolean> {
  return deleteRow(businessId, id)
}
