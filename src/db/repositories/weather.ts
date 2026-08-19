/**
 * Observed weather repository.
 *
 * Observed weather is recorded for a past date and stored permanently.
 * Forecasts are read at send time and never stored.
 */

import { and, eq } from 'drizzle-orm'

import { db } from '../client'
import { observedWeather } from '../schema'

export type ObservedWeather = typeof observedWeather.$inferSelect
export type NewObservedWeather = typeof observedWeather.$inferInsert

/** Insert, or leave the existing row alone. One observation per property per day. */
export async function recordObservedWeather(
  businessId: string,
  input: Omit<NewObservedWeather, 'businessId'>
) {
  const [row] = await db()
    .insert(observedWeather)
    .values({ ...input, businessId })
    .onConflictDoNothing({ target: [observedWeather.propertyId, observedWeather.observedDate] })
    .returning()
  return row ?? null
}

export async function getObservedWeather(
  businessId: string,
  propertyId: string,
  observedDate: string
) {
  const [row] = await db()
    .select()
    .from(observedWeather)
    .where(
      and(
        eq(observedWeather.businessId, businessId),
        eq(observedWeather.propertyId, propertyId),
        eq(observedWeather.observedDate, observedDate)
      )
    )
    .limit(1)
  return row ?? null
}
