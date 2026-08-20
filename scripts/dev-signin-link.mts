/**
 * Mint a sign-in link for a development admin.
 *
 * DEVELOPMENT ONLY. Not imported by the app, not reachable over HTTP, and
 * requires DATABASE_URL — it is a database operation, not an endpoint.
 *
 * Why it exists: signing in requires receiving an email, and Resend's shared
 * `onboarding@resend.dev` sender only delivers to the address that owns the
 * API key. The seeded co-administrator is at example.com and can never
 * receive one, so evaluating anything that needs two admins — the
 * `docs/spec.md` §10 confirmation question, for instance — is otherwise
 * impossible until a domain is verified in Phase 7.
 *
 *   pnpm dev:signin                          # lists the admins
 *   pnpm dev:signin co-admin+sittter@example.com
 */

import 'dotenv/config'
import { randomBytes } from 'node:crypto'

import { getOnlyBusiness } from '../src/db/repositories/businesses'
import { findAdminByEmail, listAdmins } from '../src/db/repositories/admins'
import { createMagicLinkToken } from '../src/db/repositories/auth'
import { hashToken } from '../src/services/auth'

const business = await getOnlyBusiness()
if (business === null) {
  console.error('The database is not seeded. Run pnpm db:seed first.')
  process.exit(1)
}

const email = process.argv[2]

if (email === undefined) {
  console.log(`Admins in ${business.name}:\n`)
  for (const admin of await listAdmins(business.id)) {
    console.log(`  ${admin.name.padEnd(20)} ${admin.email}`)
  }
  console.log('\nPass one of these addresses to get a sign-in link.')
  process.exit(0)
}

const admin = await findAdminByEmail(business.id, email)
if (admin === null) {
  console.error(`No admin with that address in ${business.name}.`)
  process.exit(1)
}

// Longer than the product's 15 minutes, because this is pasted by hand rather
// than tapped out of an inbox.
const token = randomBytes(32).toString('base64url')
await createMagicLinkToken(business.id, {
  adminId: admin.id,
  tokenHash: hashToken(token),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
})

const base = process.env.APP_URL ?? 'http://localhost:3000'
console.log(`\nSigning in as ${admin.name} <${admin.email}>`)
console.log('Single use, valid 24 hours. Open it in a private window to keep your other session.\n')
console.log(`${base}/api/auth/callback?token=${encodeURIComponent(token)}\n`)
