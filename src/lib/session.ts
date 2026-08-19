/**
 * Session cookie read and write.
 *
 * The cookie carries an opaque token and nothing else. It is not a signed
 * payload and encodes no identifier — the token is looked up server-side and
 * the row decides. That is what makes a session revocable.
 */

import { cookies } from 'next/headers'

export const SESSION_COOKIE_NAME = 'sittter_session'

/** 90 days. Spec §6.2: sessions are long-lived so a phone stays signed in. */
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60

/**
 * The cookie's attributes.
 *
 * Exported as a single object so there is one definition, used by the writer
 * and asserted by a test. Two copies would be one copy too many.
 *
 *   httpOnly  script cannot read it, so an injection cannot exfiltrate it
 *   secure    set in every environment; browsers exempt http://localhost
 *   sameSite  'lax', not 'strict', so following the emailed link carries it.
 *             'strict' would drop the cookie on the cross-site navigation
 *             from a mail client and sign-in would appear to silently fail.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE_NAME)?.value ?? null
}

export async function writeSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
}
