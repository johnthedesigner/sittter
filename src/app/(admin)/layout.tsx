import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { getOnlyBusiness } from '@/db/repositories/businesses'
import { readSessionCookie } from '@/lib/session'
import { verifySession } from '@/services/auth'
import type { Admin } from '@/db/repositories/admins'

/**
 * The session guard for every admin route.
 *
 * An absent cookie, an unknown token, and an expired session all redirect to
 * `/signin` — the same response, because none of them is more the visitor's
 * business than the others.
 */
export async function requireAdmin(): Promise<{ businessId: string; admin: Admin }> {
  const token = await readSessionCookie()
  if (token === null) redirect('/signin')

  const business = await getOnlyBusiness()
  if (business === null) redirect('/signin')

  const admin = await verifySession(business.id, token, new Date())
  if (admin === null) redirect('/signin')

  return { businessId: business.id, admin }
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
