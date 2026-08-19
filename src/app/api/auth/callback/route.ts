import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getOnlyBusiness } from '@/db/repositories/businesses'
import { consumeMagicLink } from '@/services/auth'
import { writeSessionCookie } from '@/lib/session'

/**
 * Consume a magic link and establish a session.
 *
 * THIN BY DESIGN. It reads the token, hands it to the service, and either
 * sets a cookie or redirects to the invalid-link message. Every failure —
 * expired, consumed, tampered, unknown, admin deleted — comes back as null
 * and produces the SAME response, so the URL reveals nothing about which.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const token = request.nextUrl.searchParams.get('token')
  const invalid = NextResponse.redirect(new URL('/signin?invalid=1', request.nextUrl.origin))

  if (token === null || token.length === 0) return invalid

  const business = await getOnlyBusiness()
  if (business === null) return invalid

  const consumed = await consumeMagicLink(business.id, token, new Date())
  if (consumed === null) return invalid

  await writeSessionCookie(consumed.sessionToken)
  return NextResponse.redirect(new URL('/home', request.nextUrl.origin))
}
