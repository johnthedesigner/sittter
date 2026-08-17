// SPIKE 1 — Google service account calendar
// docs/dev-plan.md §12, docs/META-PLAN.md §1
//
// Throwaway. Does not ship. Raw REST, no SDK, no dependencies.
//
// The assumption under test: a service account with domain-wide delegation
// DISABLED can own a calendar and share it with ordinary Gmail accounts in
// a way that works.
//
//   1. calendar.calendars.insert creates a secondary calendar     (scripted)
//   2. calendar.acl.insert grants a Gmail address reader access   (scripted)
//   3. The calendar appears in that account's Google Calendar     (BY HAND)
//   4. The calendar is visible in Apple Calendar on an iPhone     (BY HAND)
//   5. extendedProperties.private can be read back and matched    (scripted)
//
// Steps 3 and 4 cannot be scripted. The script stops and prints a checklist.
//
// Usage:
//   node scripts/spike/google-calendar.mjs
//   node scripts/spike/google-calendar.mjs --cleanup   (delete the calendar)

import { createSign } from 'node:crypto'
import { env, require_ } from './env.mjs'

const SCOPE = 'https://www.googleapis.com/auth/calendar'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'

const CLIENT_EMAIL = require_('GOOGLE_SERVICE_ACCOUNT_EMAIL')
const PRIVATE_KEY = require_('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
const SHARE_WITH = require_('SPIKE_SHARE_WITH_EMAIL')

const MARKER_KEY = 'sittterBookingId'
const MARKER_VALUE = 'spike-booking-0001'

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// ── auth ─────────────────────────────────────────────────────────────

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  )

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const signature = signer
    .sign(PRIVATE_KEY, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const assertion = `${header}.${claims}.${signature}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const body = await res.text()
  if (!res.ok) throw new Error(`token exchange ${res.status}\n${body}`)
  return JSON.parse(body).access_token
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}\n${text}`)
  return text ? JSON.parse(text) : null
}

// ── cleanup mode ─────────────────────────────────────────────────────

if (process.argv.includes('--cleanup')) {
  const id = require_('GOOGLE_CALENDAR_ID')
  const token = await getAccessToken()
  await api(token, 'DELETE', `/calendars/${encodeURIComponent(id)}`)
  console.log(`Deleted calendar ${id}`)
  console.log('Clear GOOGLE_CALENDAR_ID from .env.')
  process.exit(0)
}

// ── the spike ────────────────────────────────────────────────────────

console.log('SPIKE 1 — Google service account calendar')
console.log(`Service account: ${CLIENT_EMAIL}`)
console.log(`Sharing with:    ${SHARE_WITH}`)
console.log('Domain-wide delegation: not used — the assumption is that it is not needed.\n')

const token = await getAccessToken()
console.log('Step 0 — token exchange: OK (JWT-bearer, no delegation)\n')

// 1 ─ create a secondary calendar owned by the service account
const calendar = await api(token, 'POST', '/calendars', {
  summary: 'sittter — spike calendar',
  description: 'Throwaway calendar created by scripts/spike/google-calendar.mjs',
  timeZone: env.APP_TIMEZONE || 'America/New_York',
})
const calendarId = calendar.id
console.log('Step 1 — calendars.insert: PASS')
console.log(`  calendar id: ${calendarId}\n`)

// 2 ─ grant the personal Gmail address reader access
const acl = await api(token, 'POST', `/calendars/${encodeURIComponent(calendarId)}/acl`, {
  role: 'reader',
  scope: { type: 'user', value: SHARE_WITH },
})
console.log('Step 2 — acl.insert: PASS')
console.log(`  rule ${acl.id} → role "${acl.role}"\n`)

// 5 ─ write an event carrying extendedProperties.private, then match on it
const created = await api(token, 'POST', `/calendars/${encodeURIComponent(calendarId)}/events`, {
  summary: 'Spike visit — extendedProperties round trip',
  start: { date: '2026-09-01' },
  end: { date: '2026-09-02' },
  extendedProperties: { private: { [MARKER_KEY]: MARKER_VALUE } },
})
console.log('Step 5a — events.insert with extendedProperties.private: PASS')
console.log(`  event id: ${created.id}`)

const query = new URLSearchParams({ privateExtendedProperty: `${MARKER_KEY}=${MARKER_VALUE}` })
const found = await api(
  token,
  'GET',
  `/calendars/${encodeURIComponent(calendarId)}/events?${query}`
)
const matched = found.items ?? []
const roundTripped =
  matched.length === 1 &&
  matched[0].id === created.id &&
  matched[0].extendedProperties?.private?.[MARKER_KEY] === MARKER_VALUE

console.log(`Step 5b — query by privateExtendedProperty: ${roundTripped ? 'PASS' : 'FAIL'}`)
console.log(`  matched ${matched.length} event(s), reconcilable by marker: ${roundTripped}\n`)

// ── what the script cannot prove ─────────────────────────────────────

console.log('─'.repeat(68))
console.log('SCRIPTED STEPS COMPLETE. The remaining two are verified by hand.')
console.log('─'.repeat(68))
console.log(`
Step 3 — does the calendar appear in ${SHARE_WITH}'s Google Calendar?

  Open calendar.google.com signed in as that account and look for
  "sittter — spike calendar" under Other calendars.

  RECORD WHICH: did it appear automatically, or did it require accepting
  an invitation first? docs/META-PLAN.md §1 asks for this specifically —
  it decides whether onboarding a family member in Phase 5 is one step
  or two, and it is the detail most likely to change that phase's shape.

Step 4 — is it visible in Apple Calendar on the iPhone?

  On the phone: Settings → Apps → Calendar → Accounts → the Google
  account → make sure Calendars is on. Then open Calendar and look in
  the calendar list. A newly shared Google calendar often does NOT sync
  to iOS until it is enabled at calendar.google.com/calendar/syncselect
  on that account — check there before calling this a failure.

The calendar and its event are left in place so you can perform both
checks. When finished:

  node scripts/spike/google-calendar.mjs --cleanup
`)

console.log('Add this to .env so --cleanup can find it:')
console.log(`GOOGLE_CALENDAR_ID=${calendarId}`)
