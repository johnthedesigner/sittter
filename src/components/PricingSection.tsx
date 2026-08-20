'use client'

import { useActionState, useState } from 'react'

import {
  addAdhocAction,
  deleteAdhocAction,
  overrideCountsAction,
} from '@/app/(admin)/actions/pricing'
import type { LineItem } from '@/core/types'

import { formatCents } from './format'
import { EMPTY_PRICING_STATE } from './pricing-state'
import type { PricingState } from './pricing-state'

const field = 'mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base'

export interface PricingView {
  lineItems: LineItem[]
  totalCents: number
  dayCount: number
  visitCount: number
  dayCountWasOverridden: boolean
  visitCountWasOverridden: boolean
  isSnapshot: boolean
  adhocIds: Record<string, string>
  summary: string
}

function CopySummary({ summary }: { summary: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div>
      <button
        type="button"
        data-testid="copy-summary"
        data-summary={summary}
        onClick={() => {
          void navigator.clipboard.writeText(summary).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
        }}
        className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
      >
        {copied ? 'Copied' : 'Copy summary'}
      </button>
      {copied && (
        <span data-testid="copy-confirmed" className="ml-2 text-xs text-stone-600">
          Summary copied
        </span>
      )}
    </div>
  )
}

export function PricingSection({
  bookingId,
  pricing,
}: {
  bookingId: string
  pricing: PricingView
}) {
  const [countState, countAction, countPending] = useActionState<PricingState, FormData>(
    overrideCountsAction,
    EMPTY_PRICING_STATE
  )
  const [adhocState, adhocAction, adhocPending] = useActionState<PricingState, FormData>(
    addAdhocAction,
    EMPTY_PRICING_STATE
  )

  return (
    <div className="mt-3 flex flex-col gap-4">
      {pricing.isSnapshot && (
        <p data-testid="snapshot-note" className="text-xs text-stone-600">
          These rates were snapshotted when the booking was confirmed. Changing the business
          defaults will not change this total.
        </p>
      )}

      {pricing.lineItems.length === 0 ? (
        <p data-testid="no-line-items" className="text-sm text-stone-600">
          Nothing to price yet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {pricing.lineItems.map((item, index) => (
              <tr key={`${item.label}-${index}`} data-testid="line-item" data-source={item.source}>
                <td className="py-1 pr-2 align-top">
                  <span className="font-medium" data-testid="line-item-label">
                    {item.label}
                  </span>
                  <span className="block text-xs text-stone-600" data-testid="line-item-basis">
                    {item.basis}
                  </span>
                </td>
                <td
                  className="py-1 text-right align-top tabular-nums"
                  data-testid="line-item-amount"
                >
                  {formatCents(item.amountCents)}
                </td>
                <td className="w-8 py-1 text-right align-top">
                  {item.source === 'adhoc' && pricing.adhocIds[item.label] !== undefined && (
                    <form action={deleteAdhocAction}>
                      <input type="hidden" name="bookingId" value={bookingId} />
                      <input type="hidden" name="adhocId" value={pricing.adhocIds[item.label]} />
                      <button
                        type="submit"
                        data-testid="delete-adhoc"
                        className="text-xs underline"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t border-stone-300">
              <td className="py-2 font-semibold">Total</td>
              <td
                className="py-2 text-right font-semibold tabular-nums"
                data-testid="pricing-total"
              >
                {formatCents(pricing.totalCents)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      )}

      <p className="text-xs text-stone-600">
        <span data-testid="day-count">{pricing.dayCount}</span> days
        {pricing.dayCountWasOverridden && (
          <span data-testid="day-count-overridden"> (overridden)</span>
        )}
        {' · '}
        <span data-testid="visit-count">{pricing.visitCount}</span> visits
        {pricing.visitCountWasOverridden && (
          <span data-testid="visit-count-overridden"> (overridden)</span>
        )}
      </p>

      <CopySummary summary={pricing.summary} />

      <form
        action={countAction}
        className="flex flex-col gap-2 rounded-md border border-stone-200 p-3"
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        {countState.error !== null && (
          <p role="alert" data-testid="count-error" className="text-sm text-red-900">
            {countState.error}
          </p>
        )}
        <p className="text-sm font-medium">Override counts</p>
        <p className="text-xs text-stone-600">Leave empty to use the dates and the schedule.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dayCountOverride" className="text-xs">
              Days
            </label>
            <input
              id="dayCountOverride"
              name="dayCountOverride"
              type="number"
              min="0"
              data-testid="day-count-override"
              defaultValue={pricing.dayCountWasOverridden ? pricing.dayCount : ''}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="visitCountOverride" className="text-xs">
              Visits
            </label>
            <input
              id="visitCountOverride"
              name="visitCountOverride"
              type="number"
              min="0"
              data-testid="visit-count-override"
              defaultValue={pricing.visitCountWasOverridden ? pricing.visitCount : ''}
              className={field}
            />
          </div>
        </div>
        <button
          type="submit"
          data-testid="save-counts"
          disabled={countPending}
          className="self-start rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Save counts
        </button>
      </form>

      <form
        action={adhocAction}
        className="flex flex-col gap-2 rounded-md border border-stone-200 p-3"
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        {adhocState.error !== null && (
          <p role="alert" data-testid="adhoc-error" className="text-sm text-red-900">
            {adhocState.error}
          </p>
        )}
        <p className="text-sm font-medium">Add a line item</p>
        <input name="label" data-testid="adhoc-label" placeholder="Cat litter" className={field} />
        <input
          name="amount"
          data-testid="adhoc-amount"
          placeholder="15.00, or -10.00 for a discount"
          className={field}
        />
        <button
          type="submit"
          data-testid="save-adhoc"
          disabled={adhocPending}
          className="self-start rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Add line item
        </button>
      </form>
    </div>
  )
}
