/**
 * Admin authentication — magic link issue and consume, session lifecycle.
 *
 * PURE OF CLOCKS. Every function takes the current instant as an argument,
 * so expiry is tested by passing a later instant rather than by waiting.
 *
 * Three rules this module exists to hold:
 *
 *   ONLY HASHES ARE STORED. The plaintext token lives in the emailed URL and
 *   the session cookie, and nowhere else. A database leak yields no working
 *   links and no working sessions.
 *
 *   NOTHING REVEALS WHETHER AN ADDRESS IS REGISTERED. `issueMagicLink`
 *   returns the same value either way. `docs/user-journeys.md` step 8.1.5.
 *
 *   EVERYTHING FAILS CLOSED. An expired token, a consumed token, a tampered
 *   token, and a token whose admin has been deleted all produce null rather
 *   than an exception or a partial success.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { MAGIC_LINK_COPY, MagicLinkEmail } from '@/emails/magic-link'
import { markAdminSeen, findAdminByEmail, getAdmin } from '@/db/repositories/admins'
import {
  consumeMagicLinkToken,
  createMagicLinkToken,
  createSession as createSessionRow,
  deleteSession as deleteSessionRow,
  findLiveMagicLinkToken,
  findSession,
} from '@/db/repositories/auth'
import { env } from '@/lib/env'
import { sendEmail } from './email'
import type { Admin } from '@/db/repositories/admins'

/** 15 minutes. An email sitting in an inbox is the exposure. */
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000

/** 90 days, matching the cookie. */
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000

/** 32 bytes of entropy, base64url so it survives a URL and a cookie unescaped. */
const TOKEN_BYTES = 32

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/**
 * SHA-256, hex encoded.
 *
 * A fast hash is correct here and a slow one would not be: these are 256-bit
 * random tokens, not passwords. There is no dictionary to attack, so key
 * stretching buys nothing and would cost latency on every request.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Constant-time comparison, so a mismatch's position is not observable. */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * The result of requesting a sign-in link.
 *
 * DELIBERATELY CARRIES NO INFORMATION. It is identical whether the address
 * belongs to an admin or not, whether an email was sent or not, and whether
 * delivery succeeded or not. A caller that could tell the difference would
 * eventually leak it to a surface.
 */
export interface MagicLinkRequest {
  readonly requested: true
}

const REQUESTED: MagicLinkRequest = { requested: true }

function signInUrl(token: string): string {
  return `${env().APP_URL}/api/auth/callback?token=${encodeURIComponent(token)}`
}

/**
 * Issue a sign-in link, if the address belongs to an admin.
 *
 * Returns the same value either way. When no admin matches, no token is
 * created and no email is sent — and the caller cannot tell.
 */
export async function issueMagicLink(
  businessId: string,
  email: string,
  now: Date
): Promise<MagicLinkRequest> {
  const admin = await findAdminByEmail(businessId, email)
  if (admin === null) return REQUESTED

  const token = generateToken()
  await createMagicLinkToken(businessId, {
    adminId: admin.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + MAGIC_LINK_TTL_MS),
  })

  // Delivery failure is recorded in email_sends and does not change what the
  // caller sees. See AGENTS.md, integrations fail soft.
  await sendEmail(businessId, {
    kind: 'magic_link',
    to: admin.email,
    subject: MAGIC_LINK_COPY.subject,
    body: MagicLinkEmail({ signInUrl: signInUrl(token) }),
  })

  return REQUESTED
}

export interface ConsumedLink {
  admin: Admin
  /** The plaintext session token. Give it to the cookie; it is never stored. */
  sessionToken: string
}

/**
 * Consume a magic link token and establish a session.
 *
 * Returns null for every failure — expired, already consumed, never existed,
 * tampered with, or belonging to an admin who has since been deleted. The
 * caller shows one message for all of them.
 */
export async function consumeMagicLink(
  businessId: string,
  token: string,
  now: Date
): Promise<ConsumedLink | null> {
  const tokenHash = hashToken(token)

  const live = await findLiveMagicLinkToken(businessId, tokenHash)
  if (live === null) return null

  // Expiry is compared here, against the instant we were given.
  if (live.expiresAt.getTime() <= now.getTime()) return null

  const consumed = await consumeMagicLinkToken(businessId, tokenHash, now)
  if (consumed === null) return null

  const admin = await getAdmin(businessId, live.adminId)
  if (admin === null) return null

  const sessionToken = await createSession(businessId, admin.id, now)
  await markAdminSeen(businessId, admin.id, now)

  return { admin, sessionToken }
}

/** Create a session and return its plaintext token. Only the hash is stored. */
export async function createSession(
  businessId: string,
  adminId: string,
  now: Date
): Promise<string> {
  const sessionToken = generateToken()
  await createSessionRow(businessId, {
    adminId,
    tokenHash: hashToken(sessionToken),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  })
  return sessionToken
}

/**
 * The admin a session token belongs to, or null.
 *
 * Null for an unknown token, a tampered token, and an expired one alike.
 */
export async function verifySession(
  businessId: string,
  sessionToken: string,
  now: Date
): Promise<Admin | null> {
  const found = await findSession(businessId, hashToken(sessionToken))
  if (found === null) return null
  if (found.session.expiresAt.getTime() <= now.getTime()) return null
  return getAdmin(businessId, found.adminId)
}

/** Sign out. Returns false when the token was already unknown. */
export async function destroySession(businessId: string, sessionToken: string): Promise<boolean> {
  return deleteSessionRow(businessId, hashToken(sessionToken))
}
