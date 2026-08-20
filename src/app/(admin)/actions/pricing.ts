'use server'

import { revalidatePath } from 'next/cache'

import { todayIn } from '@/core/dates'
import { env } from '@/lib/env'
import {
  PricingError,
  addAdhoc,
  overrideCounts,
  removeAdhoc,
  removeComponent,
  saveComponent,
} from '@/services/pricing'
import type { PricingComponentType } from '@/core/types'
import type { PricingState } from '@/components/pricing-state'

import { actingAdmin } from './bookings'

const TYPES: PricingComponentType[] = ['per_day', 'per_visit', 'flat', 'per_hour', 'custom']

/**
 * Dollars typed by a person into integer cents.
 *
 * Parsed from the STRING rather than by multiplying a float by 100, because
 * `19.99 * 100` is 1998.9999999999998 and rounding that is a coin flip on
 * some values. AGENTS.md: no floating point arithmetic touches a currency
 * value.
 */
function dollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, '')
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const negative = trimmed.startsWith('-')
  const [whole, fraction = ''] = trimmed.replace('-', '').split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return negative ? -cents : cents
}

export async function savePricingComponentAction(
  _previous: PricingState,
  formData: FormData
): Promise<PricingState> {
  const { businessId } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')
  const type = String(formData.get('type') ?? '') as PricingComponentType
  if (!TYPES.includes(type)) return { error: 'That is not a component type.' }

  const cents = dollarsToCents(String(formData.get('amount') ?? ''))
  if (cents === null) return { error: 'Enter an amount like 5 or 5.00.' }

  try {
    await saveComponent(businessId, {
      id: String(formData.get('componentId') ?? '') || null,
      bookingId: bookingId.length > 0 ? bookingId : null,
      type,
      label: String(formData.get('label') ?? ''),
      amountCents: cents,
      sortOrder: Number(String(formData.get('sortOrder') ?? '0')),
    })
  } catch (error: unknown) {
    if (error instanceof PricingError) return { error: error.message }
    throw error
  }

  revalidatePath(bookingId.length > 0 ? `/bookings/${bookingId}` : '/settings')
  return { error: null }
}

export async function deletePricingComponentAction(formData: FormData): Promise<void> {
  const { businessId } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')
  await removeComponent(businessId, String(formData.get('componentId') ?? ''))
  revalidatePath(bookingId.length > 0 ? `/bookings/${bookingId}` : '/settings')
}

export async function addAdhocAction(
  _previous: PricingState,
  formData: FormData
): Promise<PricingState> {
  const { businessId } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')

  const cents = dollarsToCents(String(formData.get('amount') ?? ''))
  if (cents === null) return { error: 'Enter an amount like 15 or -10.00.' }

  try {
    await addAdhoc(
      businessId,
      bookingId,
      String(formData.get('label') ?? ''),
      cents,
      Number(String(formData.get('sortOrder') ?? '0'))
    )
  } catch (error: unknown) {
    if (error instanceof PricingError) return { error: error.message }
    throw error
  }

  revalidatePath(`/bookings/${bookingId}`)
  return { error: null }
}

export async function deleteAdhocAction(formData: FormData): Promise<void> {
  const { businessId } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')
  await removeAdhoc(businessId, String(formData.get('adhocId') ?? ''))
  revalidatePath(`/bookings/${bookingId}`)
}

export async function overrideCountsAction(
  _previous: PricingState,
  formData: FormData
): Promise<PricingState> {
  const { businessId, admin } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')

  const read = (key: string): number | null => {
    const raw = String(formData.get(key) ?? '').trim()
    return raw.length === 0 ? null : Number(raw)
  }

  try {
    await overrideCounts(
      businessId,
      admin.id,
      admin.name,
      bookingId,
      read('dayCountOverride'),
      read('visitCountOverride'),
      todayIn(env().APP_TIMEZONE, new Date())
    )
  } catch (error: unknown) {
    if (error instanceof PricingError) return { error: error.message }
    throw error
  }

  revalidatePath(`/bookings/${bookingId}`)
  return { error: null }
}
