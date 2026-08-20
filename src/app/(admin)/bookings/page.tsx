import Link from 'next/link'

import { todayIn } from '@/core/dates'
import { deriveStatus } from '@/core/status'
import type { BookingStatus } from '@/core/types'
import { listBookingSummaries } from '@/db/repositories/bookings'
import { listAdmins } from '@/db/repositories/admins'
import { toBookingCore } from '@/services/home'
import { FlagIndicator } from '@/components/FlagIndicator'
import { StatusChip } from '@/components/StatusChip'
import { FILTERABLE_STATUSES, ADMIN_STATUS_LABELS } from '@/components/status'
import { formatAttribution, formatRange } from '@/components/format'
import { env } from '@/lib/env'

import { requireAdmin } from '../layout'

/**
 * The booking list.
 *
 * BOTH CONFIRMATION FLAGS ARE THEIR OWN COLUMNS. `docs/spec.md` §5.5 requires
 * that an admin can see which of the two is missing without opening the
 * booking — that is the whole reason this screen shows them separately rather
 * than collapsing them into the status chip.
 *
 * Status comes from `deriveStatus` and is computed nowhere else.
 */
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { businessId } = await requireAdmin()
  const params = await searchParams

  const today = todayIn(env().APP_TIMEZONE, new Date())
  const [summaries, admins] = await Promise.all([
    listBookingSummaries(businessId),
    listAdmins(businessId),
  ])

  const nameById = new Map(admins.map((a) => [a.id, a.name]))

  const rows = summaries.map((summary) => ({
    summary,
    status: deriveStatus(toBookingCore(summary.booking), today),
  }))

  const active = FILTERABLE_STATUSES.includes(params.status as BookingStatus)
    ? (params.status as BookingStatus)
    : null

  const visible = active === null ? rows : rows.filter((r) => r.status === active)

  return (
    <main>
      <h1 className="text-xl font-semibold tracking-tight">Bookings</h1>

      {/*
        Filter as links rather than a client-side control, so the active
        filter lives in the URL and survives a reload and a back button.
      */}
      <nav className="mt-3 flex flex-wrap gap-2" data-testid="status-filter">
        <Link
          href="/bookings"
          data-active={active === null ? 'true' : 'false'}
          className={`rounded-full px-3 py-1 text-xs font-medium ${active === null ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-700'}`}
        >
          All
        </Link>
        {FILTERABLE_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/bookings?status=${status}`}
            data-status={status}
            data-active={active === status ? 'true' : 'false'}
            className={`rounded-full px-3 py-1 text-xs font-medium ${active === status ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-700'}`}
          >
            {ADMIN_STATUS_LABELS[status]}
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600" data-testid="empty-list">
          No bookings{active === null ? ' yet' : ` with status ${ADMIN_STATUS_LABELS[active]}`}.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {visible.map(({ summary, status }) => {
            const b = summary.booking
            return (
              <li
                key={b.id}
                data-testid="booking-row"
                data-booking-id={b.id}
                className="rounded-md border border-stone-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/bookings/${b.id}`} className="block truncate font-medium">
                      {summary.customerName}
                    </Link>
                    <p className="truncate text-sm text-stone-600">{summary.propertyNickname}</p>
                    <p className="text-sm text-stone-600">{formatRange(b.startDate, b.endDate)}</p>
                  </div>
                  <StatusChip status={status} />
                </div>

                {/* The two flags, as separate columns. */}
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-stone-100 pt-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-stone-400">Dates firm</p>
                    <FlagIndicator
                      label="Dates firm"
                      set={b.datesFirmAt !== null}
                      attribution={formatAttribution(
                        'Set',
                        nameById.get(b.datesFirmBy ?? '') ?? 'an admin',
                        b.datesFirmAt?.toISOString() ?? null
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-stone-400">
                      Calendar checked
                    </p>
                    <FlagIndicator
                      label="Calendar checked"
                      set={b.availabilityCheckedAt !== null}
                      attribution={formatAttribution(
                        'Checked',
                        nameById.get(b.availabilityCheckedBy ?? '') ?? 'an admin',
                        b.availabilityCheckedAt?.toISOString() ?? null
                      )}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
