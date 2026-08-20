import { notFound } from 'next/navigation'

import { todayIn } from '@/core/dates'
import { deriveStatus } from '@/core/status'
import { getBookingSummary } from '@/db/repositories/bookings'
import { listActivityForBooking } from '@/db/repositories/activity'
import { listAdmins } from '@/db/repositories/admins'
import { toBookingCore } from '@/services/home'
import { StatusChip } from '@/components/StatusChip'
import { FlagIndicator } from '@/components/FlagIndicator'
import { formatAttribution, formatCalendarDate, formatRange } from '@/components/format'
import { ACTIVITY_SOURCE_LABELS } from '@/components/activity'
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

  const [activity, admins, property, effective] = await Promise.all([
    listActivityForBooking(businessId, id),
    listAdmins(businessId),
    getProperty(businessId, summary.booking.propertyId),
    effectiveInstructionsForBooking(businessId, summary.booking.propertyId, id),
  ])
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
        {activity.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {activity.map((entry) => (
              <li
                key={entry.id}
                data-testid="activity-entry"
                data-system={entry.isSystem ? 'true' : 'false'}
                className={`rounded-md border p-3 text-sm ${
                  entry.isSystem
                    ? 'border-stone-100 bg-stone-100 text-stone-600'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <p>{entry.note}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {ACTIVITY_SOURCE_LABELS[entry.source]} · {formatCalendarDate(entry.entryDate)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
