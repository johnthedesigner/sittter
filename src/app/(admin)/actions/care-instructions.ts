'use server'

import { revalidatePath } from 'next/cache'

import type { Cadence } from '@/core/types'
import {
  CareInstructionError,
  removeCareInstruction,
  upsertCareInstruction,
} from '@/services/care-instructions'

import { actingAdmin } from './bookings'

export interface InstructionState {
  error: string | null
}

const CADENCES: Cadence[] = [
  'every_day',
  'every_other_day',
  'every_third_day',
  'once_at_start',
  'once_at_end',
  'as_needed',
  'custom',
]

export async function saveCareInstruction(
  _previous: InstructionState,
  formData: FormData
): Promise<InstructionState> {
  const { businessId } = await actingAdmin()

  const str = (key: string): string => String(formData.get(key) ?? '')
  const nullable = (key: string): string | null => {
    const value = str(key)
    return value.length > 0 ? value : null
  }

  const cadence = str('cadence') as Cadence
  if (!CADENCES.includes(cadence)) return { error: 'That is not a cadence.' }

  const bookingId = str('bookingId')

  try {
    await upsertCareInstruction(businessId, {
      id: nullable('instructionId'),
      label: str('label'),
      detail: nullable('detail'),
      cadence,
      cadenceCustom: nullable('cadenceCustom'),
      weatherRelevant: formData.get('weatherRelevant') === 'on',
      sortOrder: Number(str('sortOrder') || '0'),
      // Spec §5.4: an instruction added from a booking attaches to the
      // PROPERTY unless "This booking only" is chosen.
      bookingOnly: formData.get('bookingOnly') === 'on',
      propertyId: str('propertyId'),
      bookingId,
    })
  } catch (error: unknown) {
    if (error instanceof CareInstructionError) return { error: error.message }
    throw error
  }

  revalidatePath(`/bookings/${bookingId}`)
  return { error: null }
}

export async function deleteCareInstructionAction(formData: FormData): Promise<void> {
  const { businessId } = await actingAdmin()
  const bookingId = String(formData.get('bookingId') ?? '')
  await removeCareInstruction(businessId, String(formData.get('instructionId') ?? ''))
  revalidatePath(`/bookings/${bookingId}`)
}
