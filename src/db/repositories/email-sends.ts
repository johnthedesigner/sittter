/**
 * Email send log and digest send log.
 *
 * Every send is recorded, successful or not. A failure writes `error` and
 * leaves `providerId` null, and the daily job retries from this record.
 */

import { and, eq } from 'drizzle-orm'

import { db } from '../client'
import { digestSends, emailSends } from '../schema'

export type EmailSend = typeof emailSends.$inferSelect
export type NewEmailSend = typeof emailSends.$inferInsert
export type DigestSend = typeof digestSends.$inferSelect

export async function recordEmailSend(businessId: string, input: Omit<NewEmailSend, 'businessId'>) {
  const [row] = await db()
    .insert(emailSends)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('recordEmailSend inserted no row')
  return row
}

export async function listEmailSends(businessId: string): Promise<EmailSend[]> {
  return db().select().from(emailSends).where(eq(emailSends.businessId, businessId))
}

/**
 * Record that the digest went out for a date.
 *
 * Returns null when a row already exists, which is what makes the daily job
 * idempotent: a second run in the same day sends nothing.
 */
export async function recordDigestSend(businessId: string, sendDate: string, recipients: number) {
  const [row] = await db()
    .insert(digestSends)
    .values({ businessId, sendDate, recipients })
    .onConflictDoNothing({ target: [digestSends.businessId, digestSends.sendDate] })
    .returning()
  return row ?? null
}

export async function getDigestSend(businessId: string, sendDate: string) {
  const [row] = await db()
    .select()
    .from(digestSends)
    .where(and(eq(digestSends.businessId, businessId), eq(digestSends.sendDate, sendDate)))
    .limit(1)
  return row ?? null
}
