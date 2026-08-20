/**
 * Visit log repository. One log per visit, enforced by a unique constraint.
 */

import { and, eq, inArray } from 'drizzle-orm'

import { db } from '../client'
import { visitLogs } from '../schema'

export type VisitLog = typeof visitLogs.$inferSelect
export type NewVisitLog = typeof visitLogs.$inferInsert

export async function createVisitLog(businessId: string, input: Omit<NewVisitLog, 'businessId'>) {
  const [row] = await db()
    .insert(visitLogs)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createVisitLog inserted no row')
  return row
}

export async function getVisitLog(businessId: string, visitId: string) {
  const [row] = await db()
    .select()
    .from(visitLogs)
    .where(and(eq(visitLogs.businessId, businessId), eq(visitLogs.visitId, visitId)))
    .limit(1)
  return row ?? null
}

export async function updateVisitLog(
  businessId: string,
  visitLogId: string,
  patch: Partial<Omit<NewVisitLog, 'businessId' | 'id'>>
) {
  const [row] = await db()
    .update(visitLogs)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(visitLogs.businessId, businessId), eq(visitLogs.id, visitLogId)))
    .returning()
  return row ?? null
}

/** Logs for several visits at once. */
export async function listVisitLogsForVisits(
  businessId: string,
  visitIds: string[]
): Promise<VisitLog[]> {
  if (visitIds.length === 0) return []
  return db()
    .select()
    .from(visitLogs)
    .where(and(eq(visitLogs.businessId, businessId), inArray(visitLogs.visitId, visitIds)))
}
