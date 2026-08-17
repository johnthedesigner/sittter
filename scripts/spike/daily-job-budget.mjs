// SPIKE 2 — Daily job inside the Hobby budget
// docs/dev-plan.md §12, docs/META-PLAN.md §1
//
// Throwaway. Does not ship. Raw REST, no SDK, no dependencies.
//
// The assumption under test: fetching Open-Meteo forecast and past-days data
// for three coordinate pairs, doing trivial composition, and sending two
// emails through Resend completes in under eight seconds — inside the ten
// second Vercel Hobby function timeout.
//
// READ THE CAVEAT THIS PRINTS AT THE END. A local run does not measure a
// serverless cold start, which is what the assumption is actually about.
//
// Usage:
//   node scripts/spike/daily-job-budget.mjs
//   node scripts/spike/daily-job-budget.mjs --dry-run   (skip the sends)

import { env, require_ } from './env.mjs'

const TARGET_MS = 8000
const HOBBY_TIMEOUT_MS = 10000
const DRY_RUN = process.argv.includes('--dry-run')

const RESEND_API_KEY = require_('RESEND_API_KEY')
const EMAIL_FROM = require_('EMAIL_FROM')
const RECIPIENTS = require_('SPIKE_DIGEST_RECIPIENTS')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const TIMEZONE = env.APP_TIMEZONE || 'America/New_York'

// Three properties, standing in for three real ones in the service area.
const PROPERTIES = [
  { name: 'Property A', latitude: 40.7128, longitude: -74.006 },
  { name: 'Property B', latitude: 41.0534, longitude: -73.5387 },
  { name: 'Property C', latitude: 40.9312, longitude: -73.8987 },
]

const elapsed = (from) => `${Math.round(performance.now() - from)}ms`
const started = performance.now()
const timings = {}

console.log('SPIKE 2 — Daily job inside the Hobby budget')
console.log(`Target: under ${TARGET_MS}ms. Hobby timeout: ${HOBBY_TIMEOUT_MS}ms.`)
console.log(`Properties: ${PROPERTIES.length}. Recipients: ${RECIPIENTS.length}.`)
console.log(DRY_RUN ? 'Mode: dry run, no email sent.\n' : 'Mode: live, emails will send.\n')

// ── 1. weather ───────────────────────────────────────────────────────
// past_days=1 backfills yesterday's observed weather, which the real job
// stores permanently; the forecast days are read fresh and never stored.

const weatherStart = performance.now()

const weather = await Promise.all(
  PROPERTIES.map(async (property) => {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.search = new URLSearchParams({
      latitude: String(property.latitude),
      longitude: String(property.longitude),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
      timezone: TIMEZONE,
      past_days: '1',
      forecast_days: '2',
      temperature_unit: 'fahrenheit',
      precipitation_unit: 'inch',
    }).toString()

    const res = await fetch(url)
    const text = await res.text()
    if (!res.ok) throw new Error(`Open-Meteo ${res.status} for ${property.name}\n${text}`)
    return { property, daily: JSON.parse(text).daily }
  })
)

timings.weather = performance.now() - weatherStart
console.log(`1. Weather — ${PROPERTIES.length} properties in parallel: ${Math.round(timings.weather)}ms`)
for (const { property, daily } of weather) {
  console.log(
    `   ${property.name}: observed ${daily.time[0]} ` +
      `${daily.temperature_2m_min[0]}–${daily.temperature_2m_max[0]}°F, ` +
      `forecast ${daily.time[1]} ${daily.temperature_2m_min[1]}–${daily.temperature_2m_max[1]}°F`
  )
}

// ── 2. composition ───────────────────────────────────────────────────

const composeStart = performance.now()

const rows = weather
  .map(({ property, daily }) => {
    const high = daily.temperature_2m_max[1]
    const low = daily.temperature_2m_min[1]
    const rain = daily.precipitation_sum[1]
    return `<tr><td>${property.name}</td><td>${low}–${high}°F</td><td>${rain}"</td></tr>`
  })
  .join('')

const html = `<h1>Today at a glance</h1>
<p>Three active bookings. This is spike output, not the real digest.</p>
<table><thead><tr><th>Property</th><th>Forecast</th><th>Rain</th></tr></thead>
<tbody>${rows}</tbody></table>`

timings.compose = performance.now() - composeStart
console.log(`\n2. Composition: ${Math.round(timings.compose)}ms`)

// ── 3. email ─────────────────────────────────────────────────────────
// The real job sends one digest per admin. Sent in parallel, as production
// would; sequential sends would roughly double this leg.

const emailStart = performance.now()

if (DRY_RUN) {
  console.log('\n3. Email: skipped (--dry-run)')
  timings.email = 0
} else {
  const results = await Promise.all(
    RECIPIENTS.map(async (to, index) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to,
          subject: `sittter spike — daily digest timing test #${index + 1}`,
          html,
        }),
      })
      const text = await res.text()
      return { to, ok: res.ok, status: res.status, body: text }
    })
  )

  timings.email = performance.now() - emailStart
  console.log(`\n3. Email — ${RECIPIENTS.length} send(s) in parallel: ${Math.round(timings.email)}ms`)
  for (const r of results) {
    if (r.ok) {
      console.log(`   ${r.to}: sent, id ${JSON.parse(r.body).id}`)
    } else {
      console.log(`   ${r.to}: FAILED ${r.status}`)
      console.log(`   ${r.body}`)
    }
  }
  if (results.some((r) => !r.ok)) {
    console.log(
      '\n   NOTE: Resend only delivers to the address owning the API key until\n' +
        '   a domain is verified. A 403 here is a Resend account restriction,\n' +
        '   not a finding about the timing budget.'
    )
  }
}

// ── verdict ──────────────────────────────────────────────────────────

const total = performance.now() - started

console.log('\n' + '─'.repeat(68))
console.log(`Weather      ${String(Math.round(timings.weather)).padStart(6)}ms`)
console.log(`Composition  ${String(Math.round(timings.compose)).padStart(6)}ms`)
console.log(`Email        ${String(Math.round(timings.email)).padStart(6)}ms`)
console.log(`TOTAL        ${String(Math.round(total)).padStart(6)}ms   target ${TARGET_MS}ms`)
console.log('─'.repeat(68))
console.log(total < TARGET_MS ? '\nLOCAL RUN: within budget.' : '\nLOCAL RUN: OVER BUDGET.')

console.log(`
CAVEAT — read before recording this as a pass.

This measures network and API latency from a developer machine. It does
NOT measure what the assumption is about: a cold-started Vercel serverless
function. A cold start adds runtime boot and module load before any of the
above begins, and runs from Vercel's region rather than from here.

Headroom against the ${HOBBY_TIMEOUT_MS}ms timeout on this run: ${Math.round(HOBBY_TIMEOUT_MS - total)}ms.

Treat a local pass as necessary but not sufficient. The honest test deploys
this as a throwaway function and hits it cold. Record in SESSION_LOG.md
which of the two was actually run, so Phase 6 is not planned against a
number that measured the wrong thing.
`)
