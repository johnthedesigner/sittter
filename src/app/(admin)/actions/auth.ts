'use server'

import { redirect } from 'next/navigation'

import { getOnlyBusiness } from '@/db/repositories/businesses'
import { issueMagicLink } from '@/services/auth'
import { clearSessionCookie, readSessionCookie } from '@/lib/session'
import { destroySession } from '@/services/auth'

/**
 * Request a sign-in link.
 *
 * THIN BY DESIGN. It resolves the business, hands the address to the service,
 * and redirects. No database call, no token handling, no branching on whether
 * the address is registered — `issueMagicLink` returns the same value either
 * way, and this action must not be able to tell the difference.
 */
export async function requestSignInLink(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim()

  const business = await getOnlyBusiness()
  if (business !== null && email.length > 0) {
    await issueMagicLink(business.id, email, new Date())
  }

  // The same destination whatever happened above.
  redirect('/signin?sent=1')
}

export async function signOut(): Promise<void> {
  const token = await readSessionCookie()
  const business = await getOnlyBusiness()
  if (token !== null && business !== null) {
    await destroySession(business.id, token)
  }
  await clearSessionCookie()
  redirect('/signin')
}
