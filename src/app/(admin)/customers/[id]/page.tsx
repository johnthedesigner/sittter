import Link from 'next/link'
import { notFound } from 'next/navigation'

import { todayIn } from '@/core/dates'
import { getCustomer } from '@/db/repositories/customers'
import { listPropertiesForCustomer } from '@/db/repositories/properties'
import { listActivityForCustomer } from '@/db/repositories/activity'
import { listAdmins } from '@/db/repositories/admins'
import { ActivitySection } from '@/components/ActivitySection'
import type { ActivityEntryView } from '@/components/ActivitySection'
import { env } from '@/lib/env'

import { requireAdmin } from '../../layout'

/**
 * A customer, their properties, and their activity.
 *
 * ADMIN ONLY, like every screen in this route group. Activity entries never
 * reach a customer surface — there is no customer-facing read for them in
 * `src/db/repositories/activity.ts`, deliberately.
 */
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { businessId } = await requireAdmin()
  const { id } = await params

  const customer = await getCustomer(businessId, id)
  if (customer === null) notFound()

  const [properties, activity, admins] = await Promise.all([
    listPropertiesForCustomer(businessId, id),
    listActivityForCustomer(businessId, id),
    listAdmins(businessId),
  ])
  const nameById = new Map(admins.map((a) => [a.id, a.name]))
  const today = todayIn(env().APP_TIMEZONE, new Date())

  return (
    <main>
      <h1 className="text-xl font-semibold tracking-tight" data-testid="customer-name">
        {customer.name}
      </h1>
      {customer.email !== null && <p className="text-sm text-stone-600">{customer.email}</p>}
      {customer.phone !== null && <p className="text-sm text-stone-600">{customer.phone}</p>}
      {customer.notes !== null && (
        <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm" data-testid="customer-notes">
          {customer.notes}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Properties</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {properties.map((p) => (
            <li
              key={p.id}
              data-testid="customer-property"
              className="rounded-md border border-stone-200 bg-white p-3"
            >
              <p className="font-medium">{p.nickname}</p>
              {p.address !== null && <p className="text-sm text-stone-600">{p.address}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <ActivitySection
          customerId={customer.id}
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

      <Link href="/customers" className="mt-8 inline-block text-sm underline">
        All customers
      </Link>
    </main>
  )
}
