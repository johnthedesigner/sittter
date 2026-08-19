/**
 * Authentication integration tests.
 *
 * This is the security-critical module of Phase 1, so every failure mode is
 * exercised explicitly rather than inferred: expired, consumed, tampered,
 * cross-business, and orphaned-by-deletion all have their own test.
 *
 * Resend is replaced by the shared fake. The database is real.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('resend', async () => {
  const { resendModuleFake } = await import('./testing/resend-fake')
  return resendModuleFake()
})

import { createAdmin } from '@/db/repositories/admins'
import { createBusiness } from '@/db/repositories/businesses'
import { listEmailSends } from '@/db/repositories/email-sends'
import { resetDatabase, testSql } from '@/db/testing/database'
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SESSION_MAX_AGE_SECONDS } from '@/lib/session'

import {
  MAGIC_LINK_TTL_MS,
  SESSION_TTL_MS,
  consumeMagicLink,
  createSession,
  destroySession,
  hashToken,
  issueMagicLink,
  tokensMatch,
  verifySession,
} from './auth'
import { queueOutcomes, recordedSends, resetResendFake } from './testing/resend-fake'

const NOW = new Date('2026-08-17T12:00:00Z')
const ADMIN_EMAIL = 'sitter@example.com'

async function fixture() {
  const business = await createBusiness({ name: 'sittter', contactEmail: 'hello@example.com' })
  const other = await createBusiness({ name: 'Other', contactEmail: 'o@example.com' })
  const admin = await createAdmin(business.id, { email: ADMIN_EMAIL, name: 'Sitter' })
  return { business, other, admin }
}

/** Pull the token out of the URL in the email the fake captured. */
function tokenFromLastEmail(): string {
  const html = recordedSends().at(-1)!.html
  const match = /callback\?token=([^"&]+)/.exec(html)
  if (!match) throw new Error('no sign-in token found in the rendered email')
  return decodeURIComponent(match[1]!)
}

beforeEach(async () => {
  await resetDatabase()
  resetResendFake()
})

describe('token generation', () => {
  it('produces distinct high-entropy tokens', async () => {
    const { business, admin } = await fixture()
    const tokens = new Set<string>()
    for (let i = 0; i < 20; i += 1) {
      tokens.add(await createSession(business.id, admin.id, NOW))
    }
    expect(tokens.size).toBe(20)
    for (const token of tokens) {
      // 32 bytes base64url encodes to 43 characters, no padding.
      expect(token).toHaveLength(43)
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('does not use Math.random anywhere in the auth path', async () => {
    const mathObj = globalThis.Math as unknown as { random: () => number }
    const real = mathObj.random
    mathObj.random = () => {
      throw new Error('the auth path called Math.random')
    }
    try {
      const { business, admin } = await fixture()
      await issueMagicLink(business.id, ADMIN_EMAIL, NOW)
      await createSession(business.id, admin.id, NOW)
    } finally {
      mathObj.random = real
    }
  })

  it('hashes with SHA-256 and compares in constant time', () => {
    const hash = hashToken('abc')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('abc')).toBe(hash)
    expect(hashToken('abd')).not.toBe(hash)
    expect(tokensMatch(hash, hashToken('abc'))).toBe(true)
    expect(tokensMatch(hash, hashToken('abd'))).toBe(false)
    expect(tokensMatch('short', 'much longer string')).toBe(false)
  })
})

describe('issueMagicLink', () => {
  it('sends a link to a registered admin and stores only a hash', async () => {
    const { business } = await fixture()
    const result = await issueMagicLink(business.id, ADMIN_EMAIL, NOW)

    expect(result).toEqual({ requested: true })
    expect(recordedSends()).toHaveLength(1)
    expect(recordedSends()[0]!.to).toBe(ADMIN_EMAIL)

    const token = tokenFromLastEmail()
    const sql = testSql()
    const rows = await sql`select token_hash, expires_at, consumed_at from magic_link_tokens`
    expect(rows).toHaveLength(1)
    expect(rows[0]!.token_hash).toBe(hashToken(token))
    expect(rows[0]!.consumed_at).toBeNull()
  })

  it('THE PLAINTEXT TOKEN APPEARS IN NO COLUMN OF ANY AUTH TABLE', async () => {
    const { business } = await fixture()
    await issueMagicLink(business.id, ADMIN_EMAIL, NOW)
    const token = tokenFromLastEmail()
    const consumed = await consumeMagicLink(business.id, token, NOW)
    expect(consumed).not.toBeNull()

    const sql = testSql()
    const tokenRows = await sql`select * from magic_link_tokens`
    const sessionRows = await sql`select * from sessions`

    expect(JSON.stringify(tokenRows)).not.toContain(token)
    expect(JSON.stringify(sessionRows)).not.toContain(consumed!.sessionToken)
    // And the hashes that ARE stored are not the tokens.
    expect(JSON.stringify(tokenRows)).toContain(hashToken(token))
  })

  it('expires the token 15 minutes out', async () => {
    const { business } = await fixture()
    await issueMagicLink(business.id, ADMIN_EMAIL, NOW)
    const sql = testSql()
    const rows = await sql`select expires_at from magic_link_tokens`
    const expiresAt = new Date(rows[0]!.expires_at as string)
    expect(expiresAt.getTime() - NOW.getTime()).toBe(MAGIC_LINK_TTL_MS)
    expect(MAGIC_LINK_TTL_MS).toBe(15 * 60 * 1000)
  })

  it('ISSUES NOTHING FOR AN UNREGISTERED ADDRESS, AND LOOKS IDENTICAL', async () => {
    // Journey step 8.1.5.
    const { business } = await fixture()

    const registered = await issueMagicLink(business.id, ADMIN_EMAIL, NOW)
    resetResendFake()
    const unregistered = await issueMagicLink(business.id, 'nobody@example.com', NOW)

    expect(unregistered).toEqual(registered)
    expect(recordedSends()).toHaveLength(0)

    const sql = testSql()
    const rows = await sql`select count(*)::int as n from magic_link_tokens`
    expect(rows[0]!.n).toBe(1) // only the registered one
  })

  it('writes no email_sends row for an unregistered address', async () => {
    const { business } = await fixture()
    await issueMagicLink(business.id, 'nobody@example.com', NOW)
    expect(await listEmailSends(business.id)).toEqual([])
  })

  it('does not issue for an admin of another business', async () => {
    const { other } = await fixture()
    const result = await issueMagicLink(other.id, ADMIN_EMAIL, NOW)
    expect(result).toEqual({ requested: true })
    expect(recordedSends()).toHaveLength(0)
  })

  it('matches the address case-insensitively', async () => {
    const { business } = await fixture()
    await issueMagicLink(business.id, 'SITTER@EXAMPLE.COM', NOW)
    expect(recordedSends()).toHaveLength(1)
  })

  it('returns the same value even when delivery fails', async () => {
    // The caller must not be able to infer anything from a send failure.
    const { business } = await fixture()
    queueOutcomes({ kind: 'throw' }, { kind: 'throw' })

    const result = await issueMagicLink(business.id, ADMIN_EMAIL, NOW)

    expect(result).toEqual({ requested: true })
    const sends = await listEmailSends(business.id)
    expect(sends[0]!.error).not.toBeNull()
  })
})

describe('consumeMagicLink', () => {
  async function issued() {
    const f = await fixture()
    await issueMagicLink(f.business.id, ADMIN_EMAIL, NOW)
    return { ...f, token: tokenFromLastEmail() }
  }

  it('establishes a session and returns the admin', async () => {
    const { business, admin, token } = await issued()
    const result = await consumeMagicLink(business.id, token, NOW)

    expect(result).not.toBeNull()
    expect(result!.admin.id).toBe(admin.id)
    expect(result!.sessionToken).toHaveLength(43)
    expect(await verifySession(business.id, result!.sessionToken, NOW)).not.toBeNull()
  })

  it('AN EXPIRED TOKEN FAILS CLOSED', async () => {
    const { business, token } = await issued()
    const past15Minutes = new Date(NOW.getTime() + MAGIC_LINK_TTL_MS + 1)
    expect(await consumeMagicLink(business.id, token, past15Minutes)).toBeNull()
  })

  it('a token is still good one millisecond before it expires', async () => {
    const { business, token } = await issued()
    const justInTime = new Date(NOW.getTime() + MAGIC_LINK_TTL_MS - 1)
    expect(await consumeMagicLink(business.id, token, justInTime)).not.toBeNull()
  })

  it('fails exactly at the expiry instant, not after it', async () => {
    const { business, token } = await issued()
    const exactly = new Date(NOW.getTime() + MAGIC_LINK_TTL_MS)
    expect(await consumeMagicLink(business.id, token, exactly)).toBeNull()
  })

  it('A CONSUMED TOKEN FAILS ON SECOND USE', async () => {
    // Journey step 8.1.4.
    const { business, token } = await issued()
    expect(await consumeMagicLink(business.id, token, NOW)).not.toBeNull()
    expect(await consumeMagicLink(business.id, token, NOW)).toBeNull()
  })

  it('a second use creates no second session', async () => {
    const { business, token } = await issued()
    await consumeMagicLink(business.id, token, NOW)
    await consumeMagicLink(business.id, token, NOW)
    const sql = testSql()
    const rows = await sql`select count(*)::int as n from sessions`
    expect(rows[0]!.n).toBe(1)
  })

  it('A TAMPERED TOKEN FAILS CLOSED', async () => {
    const { business, token } = await issued()
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`
    expect(tampered).not.toBe(token)
    expect(await consumeMagicLink(business.id, tampered, NOW)).toBeNull()
  })

  it('a well-formed but never-issued token fails closed', async () => {
    const { business } = await issued()
    expect(await consumeMagicLink(business.id, 'a'.repeat(43), NOW)).toBeNull()
  })

  it('an empty token fails closed rather than throwing', async () => {
    const { business } = await issued()
    await expect(consumeMagicLink(business.id, '', NOW)).resolves.toBeNull()
  })

  it('A TOKEN WHOSE ADMIN HAS BEEN DELETED FAILS CLOSED, NOT THROWS', async () => {
    const { business, admin, token } = await issued()
    const sql = testSql()
    await sql`delete from admins where id = ${admin.id}`
    await expect(consumeMagicLink(business.id, token, NOW)).resolves.toBeNull()
  })

  it('a token cannot be consumed from another business', async () => {
    const { other, token } = await issued()
    expect(await consumeMagicLink(other.id, token, NOW)).toBeNull()
  })

  it('sets last_seen_at on the admin', async () => {
    const { business, admin, token } = await issued()
    await consumeMagicLink(business.id, token, NOW)
    const sql = testSql()
    const rows = await sql`select last_seen_at from admins where id = ${admin.id}`
    expect(new Date(rows[0]!.last_seen_at as string).toISOString()).toBe(NOW.toISOString())
  })
})

describe('sessions', () => {
  async function signedIn() {
    const f = await fixture()
    const sessionToken = await createSession(f.business.id, f.admin.id, NOW)
    return { ...f, sessionToken }
  }

  it('verifies a live session and returns the admin', async () => {
    const { business, admin, sessionToken } = await signedIn()
    const verified = await verifySession(business.id, sessionToken, NOW)
    expect(verified!.id).toBe(admin.id)
    expect(verified!.email).toBe(ADMIN_EMAIL)
  })

  it('lasts 90 days, so a phone stays signed in', async () => {
    const { business, sessionToken } = await signedIn()
    const day89 = new Date(NOW.getTime() + 89 * 24 * 60 * 60 * 1000)
    expect(await verifySession(business.id, sessionToken, day89)).not.toBeNull()
    expect(SESSION_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000)
  })

  it('REJECTS AN EXPIRED SESSION', async () => {
    const { business, sessionToken } = await signedIn()
    const past = new Date(NOW.getTime() + SESSION_TTL_MS + 1)
    expect(await verifySession(business.id, sessionToken, past)).toBeNull()
  })

  it('rejects a tampered or unknown session token', async () => {
    const { business, sessionToken } = await signedIn()
    expect(await verifySession(business.id, `${sessionToken}x`, NOW)).toBeNull()
    expect(await verifySession(business.id, 'z'.repeat(43), NOW)).toBeNull()
  })

  it('rejects a session belonging to another business', async () => {
    const { other, sessionToken } = await signedIn()
    expect(await verifySession(other.id, sessionToken, NOW)).toBeNull()
  })

  it('destroySession signs out, and is idempotent', async () => {
    const { business, sessionToken } = await signedIn()
    expect(await destroySession(business.id, sessionToken)).toBe(true)
    expect(await verifySession(business.id, sessionToken, NOW)).toBeNull()
    expect(await destroySession(business.id, sessionToken)).toBe(false)
  })

  it('destroySession cannot sign out another business’s session', async () => {
    const { business, other, sessionToken } = await signedIn()
    expect(await destroySession(other.id, sessionToken)).toBe(false)
    expect(await verifySession(business.id, sessionToken, NOW)).not.toBeNull()
  })
})

describe('the session cookie', () => {
  it('is httpOnly, secure, and sameSite lax', () => {
    // Asserted against the object the writer actually passes, so this cannot
    // drift from what is set on a real response.
    expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true)
    expect(SESSION_COOKIE_OPTIONS.secure).toBe(true)
    expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('lax')
    expect(SESSION_COOKIE_OPTIONS.path).toBe('/')
  })

  it('is not sameSite strict, which would break the emailed link', () => {
    // 'strict' drops the cookie on the cross-site navigation from a mail
    // client, and sign-in would appear to silently fail.
    expect(SESSION_COOKIE_OPTIONS.sameSite).not.toBe('strict')
  })

  it('lives as long as the session it carries', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(SESSION_TTL_MS / 1000)
    expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(SESSION_MAX_AGE_SECONDS)
  })

  it('is named sittter_session', () => {
    expect(SESSION_COOKIE_NAME).toBe('sittter_session')
  })
})
