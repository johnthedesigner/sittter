/**
 * Customer repository.
 *
 * Customers never sign in and hold no account. See `docs/spec.md` §6.2.
 */

import { and, eq, sql } from 'drizzle-orm'

import { db } from '../client'
import { customers } from '../schema'

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert

/**
 * The columns a customer-facing surface may see.
 *
 * `notes` is admin-only: it holds observations about the customer. Named
 * explicitly rather than omitted from a template, per AGENTS.md.
 */
export const CUSTOMER_PUBLIC_COLUMNS = {
  id: customers.id,
  name: customers.name,
  email: customers.email,
  phone: customers.phone,
} as const

export async function createCustomer(businessId: string, input: Omit<NewCustomer, 'businessId'>) {
  const [row] = await db()
    .insert(customers)
    .values({ ...input, businessId })
    .returning()
  if (!row) throw new Error('createCustomer inserted no row')
  return row
}

export async function listCustomers(businessId: string): Promise<Customer[]> {
  return db()
    .select()
    .from(customers)
    .where(eq(customers.businessId, businessId))
    .orderBy(customers.name)
}

export async function getCustomer(businessId: string, customerId: string) {
  const [row] = await db()
    .select()
    .from(customers)
    .where(and(eq(customers.businessId, businessId), eq(customers.id, customerId)))
    .limit(1)
  return row ?? null
}

/** For a customer surface. Names every column it returns; never `notes`. */
export async function getCustomerForPortal(businessId: string, customerId: string) {
  const [row] = await db()
    .select(CUSTOMER_PUBLIC_COLUMNS)
    .from(customers)
    .where(and(eq(customers.businessId, businessId), eq(customers.id, customerId)))
    .limit(1)
  return row ?? null
}

export async function updateCustomer(
  businessId: string,
  customerId: string,
  patch: Partial<Omit<NewCustomer, 'businessId' | 'id'>>
) {
  const [row] = await db()
    .update(customers)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(customers.businessId, businessId), eq(customers.id, customerId)))
    .returning()
  return row ?? null
}

/**
 * Customers whose name matches, for the capture combobox.
 *
 * Case-insensitive substring match. Returns only what the combobox shows —
 * `notes` is admin-only and this list is rendered into a client component.
 */
export async function searchCustomersByName(businessId: string, query: string) {
  return db()
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(
      and(eq(customers.businessId, businessId), sql`${customers.name} ILIKE ${'%' + query + '%'}`)
    )
    .orderBy(customers.name)
    .limit(20)
}

/** Every customer with their properties, for the capture form's initial render. */
export async function listCustomersForCapture(businessId: string) {
  return db()
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.businessId, businessId))
    .orderBy(customers.name)
}
