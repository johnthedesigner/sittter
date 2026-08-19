/**
 * Property repository.
 *
 * `access_notes` and `access_codes` are ADMIN ONLY and must never reach a
 * customer surface. That is enforced here, by naming columns in the
 * customer-facing function, not by omitting fields from a template.
 * See AGENTS.md, "Customer surfaces exclude sensitive data at the query layer".
 */

import { and, eq } from 'drizzle-orm'

import { db } from '../client'
import { properties } from '../schema'

export type Property = typeof properties.$inferSelect
export type NewProperty = typeof properties.$inferInsert

/**
 * The columns a customer-facing surface may see.
 *
 * `accessNotes` and `accessCodes` are deliberately absent. Adding either to
 * this object is a security defect, not a feature.
 */
export const PROPERTY_PUBLIC_COLUMNS = {
  id: properties.id,
  customerId: properties.customerId,
  nickname: properties.nickname,
  address: properties.address,
} as const

export async function createProperty(businessId: string, input: Omit<NewProperty, 'businessId'>) {
  const [row] = await db()
    .insert(properties)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createProperty inserted no row')
  return row
}

export async function listProperties(businessId: string): Promise<Property[]> {
  return db()
    .select()
    .from(properties)
    .where(eq(properties.businessId, businessId))
    .orderBy(properties.nickname)
}

export async function listPropertiesForCustomer(businessId: string, customerId: string) {
  return db()
    .select()
    .from(properties)
    .where(and(eq(properties.businessId, businessId), eq(properties.customerId, customerId)))
    .orderBy(properties.nickname)
}

export async function getProperty(businessId: string, propertyId: string) {
  const [row] = await db()
    .select()
    .from(properties)
    .where(and(eq(properties.businessId, businessId), eq(properties.id, propertyId)))
    .limit(1)
  return row ?? null
}

/** For a customer surface. Cannot return access notes or access codes. */
export async function getPropertyForPortal(businessId: string, propertyId: string) {
  const [row] = await db()
    .select(PROPERTY_PUBLIC_COLUMNS)
    .from(properties)
    .where(and(eq(properties.businessId, businessId), eq(properties.id, propertyId)))
    .limit(1)
  return row ?? null
}

export async function updateProperty(
  businessId: string,
  propertyId: string,
  patch: Partial<Omit<NewProperty, 'businessId' | 'id'>>
) {
  const [row] = await db()
    .update(properties)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(properties.businessId, businessId), eq(properties.id, propertyId)))
    .returning()
  return row ?? null
}
