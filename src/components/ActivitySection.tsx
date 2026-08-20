'use client'

import { useActionState, useState } from 'react'

import { addActivityEntry } from '@/app/(admin)/actions/activity'
import type { ActivitySource } from '@/core/types'

import { ACTIVITY_SOURCE_LABELS } from './activity'
import { EMPTY_ACTIVITY_STATE } from './activity-state'
import type { ActivityState } from './activity-state'
import { formatCalendarDate } from './format'

const SOURCE_ORDER: ActivitySource[] = [
  'text_message',
  'in_person',
  'phone',
  'email',
  'customer_form',
  'app',
]

const field = 'mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base'

export interface ActivityEntryView {
  id: string
  note: string
  source: ActivitySource
  entryDate: string
  isSystem: boolean
  actorName: string | null
}

export function ActivitySection({
  bookingId,
  customerId,
  entries,
  today,
}: {
  bookingId?: string
  customerId?: string
  entries: ActivityEntryView[]
  today: string
}) {
  const [state, action, pending] = useActionState<ActivityState, FormData>(
    addActivityEntry,
    EMPTY_ACTIVITY_STATE
  )
  const [adding, setAdding] = useState(false)

  return (
    <div className="mt-3 flex flex-col gap-3">
      {entries.length === 0 ? (
        <p data-testid="no-activity" className="text-sm text-stone-600">
          Nothing recorded yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-testid="activity-entry"
              data-system={entry.isSystem ? 'true' : 'false'}
              data-source={entry.source}
              data-entry-date={entry.entryDate}
              className={
                entry.isSystem
                  ? 'rounded-md border border-stone-100 bg-stone-100 p-3 text-sm text-stone-600'
                  : 'rounded-md border border-stone-200 bg-white p-3 text-sm'
              }
            >
              <p>{entry.note}</p>
              <p className="mt-1 text-xs text-stone-500">
                <span data-testid="activity-source">{ACTIVITY_SOURCE_LABELS[entry.source]}</span>
                {' · '}
                {formatCalendarDate(entry.entryDate)}
                {entry.actorName !== null && ` · ${entry.actorName}`}
                {entry.isSystem && ' · automatic'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          action={async (formData: FormData) => {
            await action(formData)
            // Close on success so the list is visible again and a second
            // entry starts from the "Add entry" button. Left open, the form
            // hides what was just recorded and there is no way back.
            if (String(formData.get('note') ?? '').trim().length > 0) setAdding(false)
          }}
          className="flex flex-col gap-2 rounded-md border border-stone-300 bg-white p-3"
        >
          {bookingId !== undefined && <input type="hidden" name="bookingId" value={bookingId} />}
          {customerId !== undefined && <input type="hidden" name="customerId" value={customerId} />}
          {state.error !== null && (
            <p role="alert" data-testid="activity-error" className="text-sm text-red-900">
              {state.error}
            </p>
          )}

          <label className="text-sm font-medium">What happened</label>
          <textarea name="note" rows={2} data-testid="activity-note" required className={field} />

          <label className="text-sm font-medium">Where it came from</label>
          <select
            name="source"
            data-testid="activity-source-select"
            defaultValue="text_message"
            className={field}
          >
            {SOURCE_ORDER.map((s) => (
              <option key={s} value={s}>
                {ACTIVITY_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>

          <label className="text-sm font-medium">When</label>
          <input
            type="date"
            name="entryDate"
            data-testid="activity-date"
            defaultValue={today}
            className={field}
          />

          <button
            type="submit"
            data-testid="save-activity"
            disabled={pending}
            className="self-start rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white"
          >
            {pending ? 'Saving…' : 'Add entry'}
          </button>
        </form>
      ) : (
        <button
          type="button"
          data-testid="add-activity"
          onClick={() => setAdding(true)}
          className="self-start rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
        >
          Add entry
        </button>
      )}
    </div>
  )
}
