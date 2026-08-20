'use server'

import { redirect } from 'next/navigation'

import { todayIn } from '@/core/dates'
import { getOnlyBusiness } from '@/db/repositories/businesses'
import { readSessionCookie } from '@/lib/session'
import { verifySession } from '@/services/auth'
import { revalidatePath } from 'next/cache'

import {
  CaptureError,
  captureBooking,
  changeBookingDates,
  propertiesForCustomer,
  updatePropertyDetails,
} from '@/services/bookings'
import { env } from '@/lib/env'

/**
 * The acting admin, for a server action.
 *
 * `requireAdmin()` in the layout redirects, which is right for a page. An
 * action needs the same resolution without the redirect semantics.
 */
export async function actingAdmin() {
  const token = await readSessionCookie()
  const business = await getOnlyBusiness()
  if (token === null || business === null) redirect('/signin')
  const admin = await verifySession(business.id, token, new Date())
  if (admin === null) redirect('/signin')
  return { businessId: business.id, admin }
}

export interface CaptureState {
  error: string | null
}

/**
 * Fast capture. THIN: reads the form, calls the service, redirects.
 *
 * A validation problem comes back as state so the form can say what is wrong,
 * rather than as an exception the user meets as an error page.
 */
export async function createBooking(
  _previous: CaptureState,
  formData: FormData
): Promise<CaptureState> {
  const { businessId, admin } = await actingAdmin()

  const read = (key: string): string | null => {
    const value = formData.get(key)
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  let bookingId: string
  try {
    const result = await captureBooking(
      businessId,
      admin.id,
      admin.name,
      {
        customerId: read('customerId'),
        newCustomerName: read('newCustomerName'),
        propertyId: read('propertyId'),
        newPropertyNickname: read('newPropertyNickname'),
        startDate: read('startDate'),
        endDate: read('endDate'),
        datesApproximate: formData.get('datesApproximate') === 'on',
        note: read('note'),
      },
      todayIn(env().APP_TIMEZONE, new Date())
    )
    bookingId = result.bookingId
  } catch (error: unknown) {
    if (error instanceof CaptureError) return { error: error.message }
    throw error
  }

  redirect(`/bookings/${bookingId}`)
}

/** Properties for a customer, for the capture form's property select. */
export async function loadPropertiesForCustomer(customerId: string) {
  const { businessId } = await actingAdmin()
  const rows = await propertiesForCustomer(businessId, customerId)
  return rows.map((r) => ({ id: r.id, nickname: r.nickname }))
}

/** Change a booking's service range. Thin: read, call the service, revalidate. */
export async function updateBookingDates(
  _previous: CaptureState,
  formData: FormData
): Promise<CaptureState> {
  const { businessId, admin } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')

  const read = (key: string): string | null => {
    const value = formData.get(key)
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  try {
    await changeBookingDates(
      businessId,
      admin.id,
      admin.name,
      bookingId,
      {
        startDate: read('startDate'),
        endDate: read('endDate'),
        datesApproximate: formData.get('datesApproximate') === 'on',
      },
      todayIn(env().APP_TIMEZONE, new Date())
    )
  } catch (error: unknown) {
    if (error instanceof CaptureError) return { error: error.message }
    throw error
  }

  revalidatePath(`/bookings/${bookingId}`)
  return { error: null }
}

/** Update the property a booking is for, access details included. */
export async function updateProperty(
  _previous: CaptureState,
  formData: FormData
): Promise<CaptureState> {
  const { businessId } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')
  const propertyId = String(formData.get('propertyId') ?? '')

  const read = (key: string): string | null => {
    const value = formData.get(key)
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  try {
    await updatePropertyDetails(businessId, propertyId, {
      nickname: String(formData.get('nickname') ?? ''),
      address: read('address'),
      accessNotes: read('accessNotes'),
      accessCodes: read('accessCodes'),
    })
  } catch (error: unknown) {
    if (error instanceof CaptureError) return { error: error.message }
    throw error
  }

  revalidatePath(`/bookings/${bookingId}`)
  return { error: null }
}
