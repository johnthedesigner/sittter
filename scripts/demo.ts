/**
 * Phase 0 demo harness.
 *
 * Phase 0 has no visual output, so green tests are the only automated signal
 * and `docs/META-PLAN.md` §6 says they are insufficient on their own. This
 * script exists to be READ BY A HUMAN. The review gate asks, in order:
 *
 *   Are the line item labels readable?
 *   Is the day count right at both ends of the range?
 *   Does an every-other-day cadence over an eight day range produce the
 *   dates you expect?
 *
 * It is printed in that order so those questions can be answered top to
 * bottom without hunting.
 *
 * Reads no environment variable, opens no network connection, writes no
 * file. Every date and every random value is supplied here as a literal.
 */

import { daysBetween, toCalendarDate } from '../src/core/dates'
import { buildDigestModel } from '../src/core/digest'
import { priceBooking } from '../src/core/pricing'
import { generateVisits } from '../src/core/schedule'
import { generateSlug } from '../src/core/slug'
import { deriveStatus } from '../src/core/status'
import { toCustomerFacingLabel } from '../src/core/presentation'
import { DEFAULT_PRICING_COMPONENTS } from '../src/core/types'
import type { BookingCore, CareInstruction, VisitCore } from '../src/core/types'

const d = toCalendarDate

// ── Fixtures. Everything is a literal; nothing is read from anywhere. ──

const START = d('2026-08-15')
const END = d('2026-08-21') // 7 days inclusive
const TODAY = d('2026-08-18') // mid-booking

const booking: BookingCore = {
  id: 'demo-booking',
  startDate: START,
  endDate: END,
  datesApproximate: false,
  datesFirmAt: '2026-08-01T14:00:00Z',
  availabilityCheckedAt: '2026-08-02T09:00:00Z',
  declinedAt: null,
  cancelledAt: null,
  paidAt: null,
  dayCountOverride: null,
  visitCountOverride: null,
}

const instructions: CareInstruction[] = [
  {
    id: 'task-cat',
    label: 'Feed the cat',
    detail: 'Half a tin, morning only.',
    cadence: 'every_day',
    cadenceCustom: null,
    weatherRelevant: false,
    sortOrder: 0,
  },
  {
    id: 'task-plants',
    label: 'Water the plants',
    detail: 'The ferns on the back porch.',
    cadence: 'every_other_day',
    cadenceCustom: null,
    weatherRelevant: true,
    sortOrder: 1,
  },
]

// ── Small display helpers. Formatting to dollars belongs at the point of
//    display, which is exactly what this script is. ──────────────────────

function dollars(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  return `${sign}$${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

function heading(text: string): void {
  console.log(`\n${'═'.repeat(74)}\n${text}\n${'═'.repeat(74)}`)
}

function rule(): void {
  console.log('─'.repeat(74))
}

// ── 1. A priced booking ────────────────────────────────────────────────

heading('1. PRICED BOOKING — the worked example from tasks/phase-0.md')

console.log(`Service range   ${START} to ${END}`)
console.log(`Today           ${TODAY}`)
console.log(`Internal status ${deriveStatus(booking, TODAY)}`)
console.log(`Customer sees   ${toCustomerFacingLabel(deriveStatus(booking, TODAY), booking)}`)

const fourVisits: VisitCore[] = ['2026-08-15', '2026-08-17', '2026-08-19', '2026-08-21'].map(
  (date) => ({
    id: `visit-${date}`,
    date: d(date),
    window: 'morning',
    durationMinutes: null,
    taskIds: ['task-cat'],
  })
)

const priced = priceBooking({
  booking,
  visits: fourVisits,
  components: DEFAULT_PRICING_COMPONENTS,
  adhocItems: [],
})

console.log('')
console.log(
  `${'Label'.padEnd(16)}${'Basis'.padEnd(24)}${'Qty'.padStart(5)}${'Unit'.padStart(10)}${'Amount'.padStart(12)}`
)
rule()
for (const item of priced.lineItems) {
  console.log(
    item.label.padEnd(16) +
      item.basis.padEnd(24) +
      String(item.quantity).padStart(5) +
      dollars(item.unitAmountCents).padStart(10) +
      dollars(item.amountCents).padStart(12)
  )
}
rule()
console.log('TOTAL'.padEnd(55) + dollars(priced.totalCents).padStart(12))
console.log('')
console.log(`Day count   ${priced.dayCount}  (${START} through ${END}, counted inclusively)`)
console.log(`Visit count ${priced.visitCount}`)
console.log(
  `Raw cents   lineItems ${priced.lineItems.map((i) => i.amountCents).join(' + ')} = ${priced.totalCents}`
)

// ── 2. A generated visit schedule ──────────────────────────────────────

heading('2. VISIT SCHEDULE — every_day cat, every_other_day plants, 7 day range')

const schedule = generateVisits({ startDate: START, endDate: END, instructions })

console.log(`${'Date'.padEnd(14)}${'Offset'.padStart(7)}   Tasks`)
rule()
for (const generated of schedule.visits) {
  const labels = generated.taskIds
    .map((id) => instructions.find((i) => i.id === id)?.label ?? id)
    .join(', ')
  const dayOffset = daysBetween(START, generated.date) - 1
  console.log(`${generated.date.padEnd(14)}${String(dayOffset).padStart(7)}   ${labels}`)
}
rule()
console.log(`${schedule.visits.length} visits over ${priced.dayCount} days.`)
console.log(
  `Both tasks on ${schedule.visits.filter((v) => v.taskIds.length === 2).length} of them; cat only on ${schedule.visits.filter((v) => v.taskIds.length === 1).length}.`
)
if (schedule.skippedInstructions.length > 0) {
  console.log('')
  for (const skipped of schedule.skippedInstructions) {
    console.log(`Skipped ${skipped.id}: ${skipped.reason}`)
  }
}

heading('2b. CADENCE CHECK — every_other_day over an 8 day range')

// docs/META-PLAN.md §6 names this case specifically at the Phase 0 gate.
const eightDay = generateVisits({
  startDate: d('2026-09-01'),
  endDate: d('2026-09-08'),
  instructions: [{ ...instructions[1]!, cadence: 'every_other_day' }],
})
console.log('Range   2026-09-01 to 2026-09-08 (8 days inclusive)')
console.log(`Visits  ${eightDay.visits.map((v) => v.date).join('  ')}`)
console.log(`Count   ${eightDay.visits.length}   Offsets 0, 2, 4, 6`)

// ── 3. A digest model ──────────────────────────────────────────────────

heading('3. DIGEST MODEL — mid-booking, one visit logged, one not')

const digest = buildDigestModel({
  today: TODAY,
  bookings: [
    {
      booking,
      propertyNickname: 'Maple Street',
      customerName: 'Dana Whitfield',
      visits: schedule.visits.map((generated) => ({
        id: `visit-${generated.date}`,
        date: generated.date,
        window: 'morning' as const,
        durationMinutes: null,
        taskIds: generated.taskIds,
      })),
      logs: [
        {
          visitId: 'visit-2026-08-15',
          outcome: 'completed',
          note: 'Cat ate everything and then sat on the newspaper for twenty minutes.',
        },
        { visitId: 'visit-2026-08-16', outcome: 'completed', note: 'All fine.' },
      ],
      instructions,
      weather: {
        highF: 84,
        lowF: 67,
        precipitationChance: 40,
        expectedInches: 0.2,
        derivedLine: 'rain likely after 2pm',
      },
    },
  ],
})

console.log(`Digest for ${digest.date}   empty: ${digest.isEmpty}`)

for (const block of digest.bookings) {
  console.log('')
  console.log(`${block.propertyNickname} — ${block.customerName}`)
  console.log(`${block.startDate} to ${block.endDate}`)
  console.log(
    block.todayVisit === null
      ? 'No visit scheduled today.'
      : `Today: ${block.todayTasks.join(', ')}`
  )
  if (block.weather !== null) {
    console.log(
      `Weather: ${block.weather.lowF}–${block.weather.highF}°F, ${block.weather.precipitationChance}% chance, ${block.weather.expectedInches}" — ${block.weather.derivedLine}`
    )
  }

  console.log('')
  console.log(
    `${'Date'.padEnd(14)}${'When'.padEnd(9)}${'Visit'.padEnd(7)}${'Logged'.padEnd(8)}${'Outcome'.padEnd(12)}Summary`
  )
  rule()
  for (const day of block.timeline) {
    console.log(
      day.date.padEnd(14) +
        day.position.padEnd(9) +
        (day.hasVisit ? 'yes' : '—').padEnd(7) +
        (day.logged ? 'yes' : '—').padEnd(8) +
        (day.outcome ?? '—').padEnd(12) +
        (day.summary ?? '')
    )
  }
}

console.log('')
if (digest.attention.length === 0) {
  console.log('Nothing needs attention.')
} else {
  console.log('Needs attention:')
  for (const item of digest.attention) {
    console.log(`  [${item.kind}] ${item.label}  → ${item.href}`)
  }
}

// ── 4. Slugs ───────────────────────────────────────────────────────────

heading('4. SLUGS — generated from a seeded source, so this output is stable')

let seed = 20260815
const seededRandom = (): number => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const slugs = Array.from({ length: 8 }, () => generateSlug(seededRandom))
console.log(slugs.join('  '))
console.log('')
console.log('All 5 characters, Crockford base32, no I L O or U.')

console.log('')
