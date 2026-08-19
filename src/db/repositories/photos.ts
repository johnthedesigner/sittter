/**
 * Photo repository. Objects live in external storage, referenced by key.
 */

import { and, eq } from 'drizzle-orm'

import { db } from '../client'
import { photos } from '../schema'

export type Photo = typeof photos.$inferSelect
export type NewPhoto = typeof photos.$inferInsert

export async function createPhoto(businessId: string, input: Omit<NewPhoto, 'businessId'>) {
  const [row] = await db()
    .insert(photos)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createPhoto inserted no row')
  return row
}

export async function listPhotosForVisitLog(businessId: string, visitLogId: string) {
  return db()
    .select()
    .from(photos)
    .where(and(eq(photos.businessId, businessId), eq(photos.visitLogId, visitLogId)))
    .orderBy(photos.createdAt)
}

export async function getPhoto(businessId: string, photoId: string) {
  const [row] = await db()
    .select()
    .from(photos)
    .where(and(eq(photos.businessId, businessId), eq(photos.id, photoId)))
    .limit(1)
  return row ?? null
}

/** Returns the storage key so the caller can delete the object itself. */
export async function deletePhoto(businessId: string, photoId: string): Promise<string | null> {
  const rows = await db()
    .delete(photos)
    .where(and(eq(photos.businessId, businessId), eq(photos.id, photoId)))
    .returning({ storageKey: photos.storageKey })
  return rows[0]?.storageKey ?? null
}

export async function totalStorageBytes(businessId: string): Promise<number> {
  const rows = await db()
    .select({ bytes: photos.bytes })
    .from(photos)
    .where(eq(photos.businessId, businessId))
  return rows.reduce((sum, r) => sum + r.bytes, 0)
}
