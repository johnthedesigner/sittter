/**
 * Care instruction repository.
 *
 * An instruction belongs to a property or to a booking, never both and never
 * neither — enforced by the `one_owner` check constraint. A booking-level
 * instruction shadows the property's for that engagement.
 */

import { and, eq, inArray } from 'drizzle-orm'

import { db } from '../client'
import { careInstructions } from '../schema'

export type CareInstructionRow = typeof careInstructions.$inferSelect
export type NewCareInstruction = typeof careInstructions.$inferInsert

export async function createCareInstruction(
  businessId: string,
  input: Omit<NewCareInstruction, 'businessId'>
) {
  const [row] = await db()
    .insert(careInstructions)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createCareInstruction inserted no row')
  return row
}

export async function listCareInstructionsForProperty(businessId: string, propertyId: string) {
  return db()
    .select()
    .from(careInstructions)
    .where(
      and(eq(careInstructions.businessId, businessId), eq(careInstructions.propertyId, propertyId))
    )
    .orderBy(careInstructions.sortOrder)
}

export async function listCareInstructionsForBooking(businessId: string, bookingId: string) {
  return db()
    .select()
    .from(careInstructions)
    .where(
      and(eq(careInstructions.businessId, businessId), eq(careInstructions.bookingId, bookingId))
    )
    .orderBy(careInstructions.sortOrder)
}

export async function deleteCareInstruction(businessId: string, id: string): Promise<boolean> {
  const rows = await db()
    .delete(careInstructions)
    .where(and(eq(careInstructions.businessId, businessId), eq(careInstructions.id, id)))
    .returning({ id: careInstructions.id })
  return rows.length > 0
}

/** Instructions for several properties at once. */
export async function listCareInstructionsForProperties(
  businessId: string,
  propertyIds: string[]
): Promise<CareInstructionRow[]> {
  if (propertyIds.length === 0) return []
  return db()
    .select()
    .from(careInstructions)
    .where(
      and(
        eq(careInstructions.businessId, businessId),
        inArray(careInstructions.propertyId, propertyIds)
      )
    )
    .orderBy(careInstructions.sortOrder)
}

export async function updateCareInstruction(
  businessId: string,
  id: string,
  patch: Partial<Omit<NewCareInstruction, 'businessId' | 'id'>>
): Promise<CareInstructionRow | null> {
  const [row] = await db()
    .update(careInstructions)
    .set(patch)
    .where(and(eq(careInstructions.businessId, businessId), eq(careInstructions.id, id)))
    .returning()
  return row ?? null
}
