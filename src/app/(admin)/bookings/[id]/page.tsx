import { notFound } from 'next/navigation'

import { todayIn } from '@/core/dates'
import { deriveStatus } from '@/core/status'
import { getBookingSummary } from '@/db/repositories/bookings'
import { listActivityForBooking } from '@/db/repositories/activity'
import { listAdmins } from '@/db/repositories/admins'
import { toBookingCore } from '@/services/home'
import { StatusChip } from '@/components/StatusChip'
import { FlagIndicator } from '@/components/FlagIndicator'
import { formatAttribution, formatRange } from '@/components/format'
import { ActivitySection } from '@/components/ActivitySection'
import type { ActivityEntryView } from '@/components/ActivitySection'
import {
  CareInstructionsSection,
  DatesSection,
  PropertySection,
} from '@/components/BookingSections'
import type { InstructionView } from '@/components/BookingSections'
import { effectiveInstructionsForBooking } from '@/services/care-instructions'
import {
  ConfirmationSection,
  PaymentSection,
  TerminalActions,
} from '@/components/ConfirmationSection'
import { VisitsSection } from '@/components/VisitsSection'
import type { SkippedView, VisitView } from '@/components/VisitsSection'
import { listVisitTaskIds, listVisitsForBooking } from '@/db/repositories/visits'
import { listVisitLogsForVisits } from '@/db/repositories/visit-logs'
import { planRegeneration } from '@/services/visits'
import { PricingSection } from '@/components/PricingSection'
import type { PricingView } from '@/components/PricingSection'
import { priceBookingById, summaryText } from '@/services/pricing'
import { listAdhocLineItems } from '@/db/repositories/pricing'
import { getProperty } from '@/db/repositories/properties'
import { env } from '@/lib/env'

import { requireAdmin } from '../../layout'

/**
 * The booking detail screen.
 *
 * Sections, in the order `docs/spec.md` §5.4 gives them: header, dates, care
 * instructions, visits, pricing, activity, links.
 *
 * Built so far: header, dates, care instructions, property details, and a
 * read-only activity list. Task 2.4 adds the confirmation toggles, 2.5
 * visits, 2.6 pricing, 2.7 manual activity entry.
 */
export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { businessId } = await requireAdmin()
  const { id } = await params

  const summary = await getBookingSummary(businessId, id)
  if (summary === null) notFound()

  const [activity, admins, property, effective, visitRows] = await Promise.all([
    listActivityForBooking(businessId, id),
    listAdmins(businessId),
    getProperty(businessId, summary.booking.propertyId),
    effectiveInstructionsForBooking(businessId, summary.booking.propertyId, id),
    listVisitsForBooking(businessId, id),
  ])

  const hasDates = summary.booking.startDate !== null && summary.booking.endDate !== null
  const logs = await listVisitLogsForVisits(
    businessId,
    visitRows.map((v) => v.id)
  )
  const loggedVisitIds = new Set(logs.map((l) => l.visitId))
  const labelById = new Map(effective.map((e) => [e.instruction.id, e.instruction.label]))

  const visitViews: VisitView[] = await Promise.all(
    visitRows.map(async (v) => ({
      id: v.id,
      date: v.visitDate,
      window: v.window,
      durationMinutes: v.durationMinutes,
      taskLabels: (await listVisitTaskIds(businessId, v.id)).map(
        (taskId) => labelById.get(taskId) ?? taskId
      ),
      hasLog: loggedVisitIds.has(v.id),
    }))
  )

  const priced = await priceBookingById(businessId, id)
  const adhocRows = await listAdhocLineItems(businessId, id)
  const pricing: PricingView | null =
    priced === null
      ? null
      : {
          lineItems: priced.lineItems,
          totalCents: priced.totalCents,
          dayCount: priced.dayCount,
          visitCount: priced.visitCount,
          dayCountWasOverridden: priced.dayCountWasOverridden,
          visitCountWasOverridden: priced.visitCountWasOverridden,
          isSnapshot: priced.isSnapshot,
          adhocIds: Object.fromEntries(adhocRows.map((a) => [a.label, a.id])),
          summary: summaryText(summary.customerName, summary.propertyNickname, priced),
        }

  // Surfaces the reason src/core/schedule.ts already gives, rather than
  // writing a second explanation of why a cadence produced nothing.
  let skipped: SkippedView[] = []
  if (hasDates) {
    try {
      skipped = (await planRegeneration(businessId, id)).skipped
    } catch {
      skipped = []
    }
  }
  const nameById = new Map(admins.map((a) => [a.id, a.name]))

  const today = todayIn(env().APP_TIMEZONE, new Date())
  const booking = summary.booking
  const status = deriveStatus(toBookingCore(booking), today)

  return (
    <main>
      <header>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="booking-customer">
          {summary.customerName}
        </h1>
        <p className="text-sm text-stone-600" data-testid="booking-property">
          {summary.propertyNickname}
        </p>
        <p className="mt-1 text-sm" data-testid="booking-range">
          {formatRange(booking.startDate, booking.endDate)}
          {booking.datesApproximate && (booking.startDate !== null || booking.endDate !== null) && (
            <span className="ml-2 text-stone-500">approximate</span>
          )}
        </p>
        <div className="mt-2">
          <StatusChip status={status} />
        </div>
        <div className="mt-2 flex gap-4">
          <FlagIndicator
            label="Dates firm"
            set={booking.datesFirmAt !== null}
            attribution={formatAttribution(
              'Set',
              nameById.get(booking.datesFirmBy ?? '') ?? 'an admin',
              booking.datesFirmAt?.toISOString() ?? null
            )}
          />
          <FlagIndicator
            label="Calendar checked"
            set={booking.availabilityCheckedAt !== null}
            attribution={formatAttribution(
              'Checked',
              nameById.get(booking.availabilityCheckedBy ?? '') ?? 'an admin',
              booking.availabilityCheckedAt?.toISOString() ?? null
            )}
          />
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Dates</h2>
        <DatesSection
          bookingId={booking.id}
          startDate={booking.startDate}
          endDate={booking.endDate}
          datesApproximate={booking.datesApproximate}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Confirmation</h2>
        <p className="mt-1 text-sm text-stone-600">
          Two separate steps. A booking is confirmed once both are done and the dates are set.
        </p>
        <ConfirmationSection
          bookingId={booking.id}
          datesFirm={booking.datesFirmAt !== null}
          datesFirmAttribution={formatAttribution(
            'Set',
            nameById.get(booking.datesFirmBy ?? '') ?? 'an admin',
            booking.datesFirmAt?.toISOString() ?? null
          )}
          availabilityChecked={booking.availabilityCheckedAt !== null}
          availabilityAttribution={formatAttribution(
            'Checked',
            nameById.get(booking.availabilityCheckedBy ?? '') ?? 'an admin',
            booking.availabilityCheckedAt?.toISOString() ?? null
          )}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Care instructions</h2>
        <CareInstructionsSection
          bookingId={booking.id}
          propertyId={booking.propertyId}
          instructions={effective.map((e): InstructionView => ({
            id: e.instruction.id,
            label: e.instruction.label,
            detail: e.instruction.detail,
            cadence: e.instruction.cadence,
            cadenceCustom: e.instruction.cadenceCustom,
            weatherRelevant: e.instruction.weatherRelevant,
            sortOrder: e.instruction.sortOrder,
            isOverride: e.isOverride,
            shadowsLabel: e.shadows?.label ?? null,
          }))}
        />
      </section>

      {property !== null && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Property</h2>
          <PropertySection
            bookingId={booking.id}
            propertyId={property.id}
            nickname={property.nickname}
            address={property.address}
            accessNotes={property.accessNotes}
            accessCodes={property.accessCodes}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Visits</h2>
        <VisitsSection
          bookingId={booking.id}
          visits={visitViews}
          skipped={skipped}
          canGenerate={hasDates}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Pricing</h2>
        {pricing === null ? (
          <p className="mt-2 text-sm text-stone-600">Nothing to price yet.</p>
        ) : (
          <PricingSection bookingId={booking.id} pricing={pricing} />
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Payment</h2>
        <PaymentSection
          bookingId={booking.id}
          paidAt={booking.paidAt}
          paidMethodNote={booking.paidMethodNote}
        />
        <TerminalActions bookingId={booking.id} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <ActivitySection
          bookingId={booking.id}
          today={today}
          entries={activity.map((e): ActivityEntryView => ({
            id: e.id,
            note: e.note,
            source: e.source,
            entryDate: e.entryDate,
            isSystem: e.isSystem,
            actorName: e.actorId === null ? null : (nameById.get(e.actorId) ?? null),
          }))}
        />
      </section>
    </main>
  )
}
