/**
 * Magic link token and session repository.
 *
 * Only hashes are stored. The plaintext token exists in the emailed URL and
 * nowhere else, so a database leak yields no working links.
 *
 * These two tables hang off `admins` rather than carrying a business
 * identifier of their own, so every function here takes `businessId` first
 * and joins through `admins` to enforce the scope — the discipline is not
 * optional just because the column is absent.
 */

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '../client'
import { admins, magicLinkTokens, sessions } from '../schema'

export type MagicLinkToken = typeof magicLinkTokens.$inferSelect
export type Session = typeof sessions.$inferSelect

export async function createMagicLinkToken(
  businessId: string,
  input: { adminId: string; tokenHash: string; expiresAt: Date }
): Promise<MagicLinkToken> {
  const admin = await db()
    .select({ id: admins.id })
    .from(admins)
    .where(and(eq(admins.businessId, businessId), eq(admins.id, input.adminId)))
    .limit(1)
  if (admin.length === 0) throw new Error('createMagicLinkToken: admin is not in this business')

  const [row] = await db().insert(magicLinkTokens).values(input).returning()
  if (!row) throw new Error('createMagicLinkToken inserted no row')
  return row
}

/**
 * An unconsumed token and its admin, or null.
 *
 * Expiry is NOT checked here — the caller compares against an instant it
 * was given, so expiry stays testable without waiting.
 */
export async function findLiveMagicLinkToken(
  businessId: string,
  tokenHash: string
): Promise<{ token: MagicLinkToken; adminId: string; expiresAt: Date } | null> {
  const [row] = await db()
    .select({ token: magicLinkTokens, adminId: admins.id })
    .from(magicLinkTokens)
    .innerJoin(admins, eq(admins.id, magicLinkTokens.adminId))
    .where(
      and(
        eq(admins.businessId, businessId),
        eq(magicLinkTokens.tokenHash, tokenHash),
        isNull(magicLinkTokens.consumedAt)
      )
    )
    .limit(1)
  if (!row) return null
  return { token: row.token, adminId: row.adminId, expiresAt: row.token.expiresAt }
}

/** Mark a token consumed. Returns null when it was already consumed. */
export async function consumeMagicLinkToken(
  businessId: string,
  tokenHash: string,
  at: Date
): Promise<MagicLinkToken | null> {
  const live = await findLiveMagicLinkToken(businessId, tokenHash)
  if (live === null) return null

  const [row] = await db()
    .update(magicLinkTokens)
    .set({ consumedAt: at })
    .where(and(eq(magicLinkTokens.tokenHash, tokenHash), isNull(magicLinkTokens.consumedAt)))
    .returning()
  return row ?? null
}

export async function createSession(
  businessId: string,
  input: { adminId: string; tokenHash: string; expiresAt: Date }
): Promise<Session> {
  const admin = await db()
    .select({ id: admins.id })
    .from(admins)
    .where(and(eq(admins.businessId, businessId), eq(admins.id, input.adminId)))
    .limit(1)
  if (admin.length === 0) throw new Error('createSession: admin is not in this business')

  const [row] = await db().insert(sessions).values(input).returning()
  if (!row) throw new Error('createSession inserted no row')
  return row
}

/** A session and its admin identifier. Expiry is the caller's comparison. */
export async function findSession(
  businessId: string,
  tokenHash: string
): Promise<{ session: Session; adminId: string } | null> {
  const [row] = await db()
    .select({ session: sessions, adminId: admins.id })
    .from(sessions)
    .innerJoin(admins, eq(admins.id, sessions.adminId))
    .where(and(eq(admins.businessId, businessId), eq(sessions.tokenHash, tokenHash)))
    .limit(1)
  if (!row) return null
  return { session: row.session, adminId: row.adminId }
}

export async function deleteSession(businessId: string, tokenHash: string): Promise<boolean> {
  const found = await findSession(businessId, tokenHash)
  if (found === null) return false
  await db().delete(sessions).where(eq(sessions.tokenHash, tokenHash))
  return true
}
