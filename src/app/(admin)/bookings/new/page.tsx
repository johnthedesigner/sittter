import { listCustomersForCapture } from '@/db/repositories/customers'
import { CaptureForm } from '@/components/CaptureForm'

import { requireAdmin } from '../../layout'

/**
 * Fast capture — spec §5.1.
 *
 * The acceptance target is thirty seconds for an admin who has done it
 * before: a new customer name, a date range, and a one-line note. That
 * measurement happens by hand on a real phone at the phase review gate.
 */
export default async function NewBookingPage() {
  const { businessId } = await requireAdmin()
  const customers = await listCustomersForCapture(businessId)

  return (
    <main>
      <h1 className="text-xl font-semibold tracking-tight">New booking</h1>
      <CaptureForm customers={customers} />
    </main>
  )
}
