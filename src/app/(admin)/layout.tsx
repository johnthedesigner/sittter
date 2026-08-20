import Link from 'next/link'
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
 *
 * Also the single place a page gets the ACTING ADMIN, which every
 * state-changing action must record. See `docs/spec.md` §6.2: attribution is
 * the accountability mechanism that replaces permissions.
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
  const { admin } = await requireAdmin()

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/home">Today</Link>
          <Link href="/bookings">Bookings</Link>
          <Link href="/customers">Customers</Link>
        </nav>
        <span className="truncate text-xs text-stone-500" data-testid="acting-admin">
          {admin.name}
        </span>
      </header>

      <div className="flex-1 px-4 py-4">{children}</div>

      {/*
        The persistent "New booking" action from spec §5.1. Fixed to the
        bottom of the viewport so it is reachable one-handed on a phone
        without scrolling, whatever is on screen.
      */}
      <div className="sticky bottom-0 border-t border-stone-200 bg-stone-50 px-4 py-3">
        <Link
          href="/bookings/new"
          data-testid="new-booking"
          className="block rounded-md bg-stone-900 px-4 py-3 text-center text-base font-semibold text-white"
        >
          New booking
        </Link>
      </div>
    </div>
  )
}
