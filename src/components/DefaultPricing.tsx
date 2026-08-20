'use client'

import { useActionState } from 'react'

import {
  deletePricingComponentAction,
  savePricingComponentAction,
} from '@/app/(admin)/actions/pricing'
import type { PricingComponentType } from '@/core/types'

import { formatCents } from './format'
import { EMPTY_PRICING_STATE } from './pricing-state'
import type { PricingState } from './pricing-state'

const TYPE_LABELS: Record<PricingComponentType, string> = {
  per_day: 'Per day',
  per_visit: 'Per visit',
  flat: 'Flat',
  per_hour: 'Per hour',
  custom: 'Custom',
}

const TYPES: PricingComponentType[] = ['per_day', 'per_visit', 'flat', 'per_hour', 'custom']
const field = 'mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base'

export interface DefaultComponent {
  id: string
  type: PricingComponentType
  label: string
  amountCents: number
  sortOrder: number
}

/** Cents to a dollar string for an input's value. Integer arithmetic only. */
function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function DefaultPricing({ components }: { components: DefaultComponent[] }) {
  const [state, action, pending] = useActionState<PricingState, FormData>(
    savePricingComponentAction,
    EMPTY_PRICING_STATE
  )

  return (
    <div className="mt-3 flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {components.map((c) => (
          <li
            key={c.id}
            data-testid="default-component"
            data-type={c.type}
            className="rounded-md border border-stone-200 bg-white p-3"
          >
            <form action={action} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="componentId" value={c.id} />
              <input type="hidden" name="sortOrder" value={c.sortOrder} />
              <div className="min-w-0 flex-1">
                <label className="text-xs">Label</label>
                <input
                  name="label"
                  defaultValue={c.label}
                  data-testid="component-label"
                  className={field}
                />
              </div>
              <div className="w-28">
                <label className="text-xs">Amount</label>
                <input
                  name="amount"
                  defaultValue={centsToInput(c.amountCents)}
                  data-testid="component-amount"
                  className={field}
                />
              </div>
              <select
                name="type"
                defaultValue={c.type}
                data-testid="component-type"
                className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                data-testid="save-component"
                disabled={pending}
                className="rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
            </form>
            <p className="mt-1 text-xs text-stone-500">
              Currently {formatCents(c.amountCents)} {TYPE_LABELS[c.type].toLowerCase()}
            </p>
            <form action={deletePricingComponentAction} className="mt-1">
              <input type="hidden" name="componentId" value={c.id} />
              <button type="submit" data-testid="delete-component" className="text-xs underline">
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>

      {state.error !== null && (
        <p role="alert" data-testid="component-error" className="text-sm text-red-900">
          {state.error}
        </p>
      )}

      <form
        action={action}
        className="flex flex-wrap items-end gap-2 rounded-md border border-stone-200 p-3"
      >
        <div className="min-w-0 flex-1">
          <label className="text-xs">New component label</label>
          <input name="label" data-testid="new-component-label" className={field} />
        </div>
        <div className="w-28">
          <label className="text-xs">Amount</label>
          <input name="amount" data-testid="new-component-amount" className={field} />
        </div>
        <select
          name="type"
          defaultValue="per_day"
          data-testid="new-component-type"
          className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          data-testid="add-component"
          className="rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Add
        </button>
      </form>
    </div>
  )
}
