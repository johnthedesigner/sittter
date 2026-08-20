import Link from 'next/link'

import { listCustomers } from '@/db/repositories/customers'

import { requireAdmin } from '../layout'

/** The customer list. Detail screens and activity arrive in Task 2.7. */
export default async function CustomersPage() {
  const { businessId } = await requireAdmin()
  const customers = await listCustomers(businessId)

  return (
    <main>
      <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
      {customers.length === 0 ? (
        <p className="mt-4 text-sm text-stone-600">No customers yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {customers.map((c) => (
            <li
              key={c.id}
              data-testid="customer-row"
              className="rounded-md border border-stone-200 bg-white p-3"
            >
              <Link href={`/customers/${c.id}`} className="font-medium">
                {c.name}
              </Link>
              {c.phone !== null && <p className="text-sm text-stone-600">{c.phone}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
