import { listDefaultPricingComponents } from '@/db/repositories/pricing'
import { DefaultPricing } from '@/components/DefaultPricing'

import { requireAdmin } from '../layout'

/**
 * Settings.
 *
 * Phase 2 builds only the default pricing components. Copy blocks, the digest
 * hour, calendar sharing, and storage usage arrive in later phases.
 */
export default async function SettingsPage() {
  const { businessId } = await requireAdmin()
  const defaults = await listDefaultPricingComponents(businessId)

  return (
    <main>
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Default pricing</h2>
        <p className="mt-1 text-sm text-stone-600">
          Applied to new bookings. A confirmed booking keeps the rates it was confirmed with.
        </p>
        <DefaultPricing
          components={defaults.map((c) => ({
            id: c.id,
            type: c.type,
            label: c.label,
            amountCents: c.amountCents,
            sortOrder: c.sortOrder,
          }))}
        />
      </section>
    </main>
  )
}
