import Link from 'next/link'

import { todayIn } from '@/core/dates'
import { buildHomeModel } from '@/services/home'
import { formatCalendarDate, formatRange } from '@/components/format'
import { env } from '@/lib/env'

import { requireAdmin } from '../layout'

/**
 * Today, and what needs attention.
 *
 * Both come from `buildHomeModel`, which delegates to
 * `buildDigestModel` in `src/core/` — so this screen and the morning email
 * cannot disagree about what needs attention.
 *
 * NOTE: `docs/dev-plan.md` Phase 2 describes this screen as "filtered by the
 * acting admin". That phrase has no definition in `docs/spec.md`, and there
 * is no assignment model to filter on — §6.2 says all admins have identical
 * capabilities. Recorded in SESSION_LOG.md as a gap for the human; the screen
 * shows the same content to every admin, matching §5.11's rule for the digest.
 */
export default async function HomePage() {
  const { businessId } = await requireAdmin()
  const today = todayIn(env().APP_TIMEZONE, new Date())
  const model = await buildHomeModel(businessId, today)

  const todaysWork = model.bookings.filter((b) => b.todayVisit !== null || b.timeline.length > 0)

  return (
    <main>
      <h1 className="text-xl font-semibold tracking-tight">Today</h1>
      <p className="mt-0.5 text-sm text-stone-500">{formatCalendarDate(model.today)}</p>

      <section className="mt-4" data-testid="today-section">
        {todaysWork.length === 0 ? (
          <p className="text-sm text-stone-600">Nothing active today.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todaysWork.map((block) => (
              <li
                key={block.bookingId}
                data-testid="today-booking"
                className="rounded-md border border-stone-200 bg-white p-3"
              >
                <Link href={`/bookings/${block.bookingId}`} className="font-medium">
                  {block.propertyNickname}
                </Link>
                <p className="text-sm text-stone-600">{block.customerName}</p>
                {block.todayVisit === null ? (
                  <p className="mt-1 text-sm text-stone-600">
                    {formatRange(block.startDate, block.endDate)} — no visit today
                  </p>
                ) : (
                  <p className="mt-1 text-sm">
                    {block.todayVisit.window}
                    {block.todayTasks.length > 0 && ` — ${block.todayTasks.join(', ')}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Needs attention</h2>
      <section className="mt-3" data-testid="attention-section">
        {model.attention.length === 0 ? (
          <p className="text-sm text-stone-600">Nothing needs attention.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {model.attention.map((item, index) => (
              <li
                key={`${item.kind}-${item.bookingId}-${index}`}
                data-testid="attention-item"
                data-kind={item.kind}
                className="rounded-md border border-stone-200 bg-white p-3 text-sm"
              >
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
