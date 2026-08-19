/**
 * Customer repository.
 *
 * Customers never sign in and hold no account. See `docs/spec.md` §6.2.
 */

import { and, eq } from 'drizzle-orm'

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
