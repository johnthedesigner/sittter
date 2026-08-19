/**
 * Admin repository.
 *
 * Admins are identified by email within a business. There is one admin role;
 * all admins have identical capabilities. See `docs/spec.md` §6.2.
 */

import { and, eq, sql } from 'drizzle-orm'

import { db } from '../client'
import { admins } from '../schema'

export type Admin = typeof admins.$inferSelect
export type NewAdmin = typeof admins.$inferInsert

export async function createAdmin(businessId: string, input: Omit<NewAdmin, 'businessId'>) {
  const [row] = await db()
    .insert(admins)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createAdmin inserted no row')
  return row
}

export async function listAdmins(businessId: string): Promise<Admin[]> {
  return db().select().from(admins).where(eq(admins.businessId, businessId)).orderBy(admins.name)
}

export async function getAdmin(businessId: string, adminId: string): Promise<Admin | null> {
  const [row] = await db()
    .select()
    .from(admins)
    .where(and(eq(admins.businessId, businessId), eq(admins.id, adminId)))
    .limit(1)
  return row ?? null
}

/**
 * Find an admin by email, case-insensitively.
 *
 * Returns null rather than throwing when no admin matches. The caller must
 * not let the difference reach a user: `docs/user-journeys.md` step 8.1.5
 * requires an unregistered address to produce the same response as a
 * registered one.
 */
export async function findAdminByEmail(businessId: string, email: string): Promise<Admin | null> {
  const [row] = await db()
    .select()
    .from(admins)
    .where(and(eq(admins.businessId, businessId), sql`lower(${admins.email}) = lower(${email})`))
    .limit(1)
  return row ?? null
}

export async function markAdminSeen(
  businessId: string,
  adminId: string,
  at: Date
): Promise<Admin | null> {
  const [row] = await db()
    .update(admins)
    .set({ lastSeenAt: at })
    .where(and(eq(admins.businessId, businessId), eq(admins.id, adminId)))
    .returning()
  return row ?? null
}
