'use client'

import { useActionState, useState } from 'react'

import {
  addVisitAction,
  deleteVisitAction,
  editVisitAction,
  regenerateVisitsAction,
} from '@/app/(admin)/actions/visits'
import { EMPTY_VISIT_STATE } from './visit-state'
import type { VisitState } from './visit-state'
import type { TimeWindow } from '@/core/types'

import { formatCalendarDate } from './format'

const WINDOW_LABELS: Record<TimeWindow, string> = {
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
}

const WINDOWS: TimeWindow[] = ['morning', 'midday', 'afternoon', 'evening', 'anytime']

const field = 'mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base'

export interface VisitView {
  id: string
  date: string
  window: TimeWindow
  durationMinutes: number | null
  taskLabels: string[]
  hasLog: boolean
}

export interface SkippedView {
  id: string
  label: string
  reason: string
}

function DeleteVisitButton({ bookingId, visit }: { bookingId: string; visit: VisitView }) {
  const [state, action, pending] = useActionState<VisitState, FormData>(
    deleteVisitAction,
    EMPTY_VISIT_STATE
  )
  const [confirming, setConfirming] = useState(false)

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="visitId" value={visit.id} />
      <input type="hidden" name="confirmed" value={confirming ? 'true' : 'false'} />

      {state.warning !== null && !confirming && (
        <p data-testid="delete-warning" className="text-xs text-amber-900">
          {state.warning}
        </p>
      )}

      <button
        type="submit"
        data-testid={confirming || state.warning !== null ? 'confirm-delete-visit' : 'delete-visit'}
        disabled={pending}
        onClick={() => {
          if (state.warning !== null) setConfirming(true)
        }}
        className="text-sm underline"
      >
        {state.warning !== null ? 'Confirm delete' : 'Delete'}
      </button>
    </form>
  )
}

export function VisitsSection({
  bookingId,
  visits,
  skipped,
  canGenerate,
}: {
  bookingId: string
  visits: VisitView[]
  skipped: SkippedView[]
  canGenerate: boolean
}) {
  const [regenState, regenAction, regenPending] = useActionState<VisitState, FormData>(
    regenerateVisitsAction,
    EMPTY_VISIT_STATE
  )
  const [addState, addAction, addPending] = useActionState<VisitState, FormData>(
    addVisitAction,
    EMPTY_VISIT_STATE
  )
  const [adding, setAdding] = useState(false)

  return (
    <div className="mt-3 flex flex-col gap-3">
      {visits.length === 0 ? (
        <p data-testid="no-visits" className="text-sm text-stone-600">
          No visits yet. They are generated when the booking is confirmed.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visits.map((v) => (
            <li
              key={v.id}
              data-testid="visit"
              data-visit-date={v.date}
              data-has-log={v.hasLog ? 'true' : 'false'}
              className="rounded-md border border-stone-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{formatCalendarDate(v.date)}</p>
                  <p className="text-sm text-stone-600" data-testid="visit-tasks">
                    {v.taskLabels.length > 0 ? v.taskLabels.join(', ') : 'No tasks'}
                  </p>
                  <form action={editVisitAction} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="bookingId" value={bookingId} />
                    <input type="hidden" name="visitId" value={v.id} />
                    <select
                      name="window"
                      defaultValue={v.window}
                      data-testid="visit-window"
                      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
                    >
                      {WINDOWS.map((w) => (
                        <option key={w} value={w}>
                          {WINDOW_LABELS[w]}
                        </option>
                      ))}
                    </select>
                    <input
                      name="durationMinutes"
                      type="number"
                      min="0"
                      placeholder="min"
                      defaultValue={v.durationMinutes ?? ''}
                      data-testid="visit-duration"
                      className="w-20 rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
                    />
                    <button type="submit" data-testid="save-visit" className="text-sm underline">
                      Save
                    </button>
                  </form>
                </div>
                <DeleteVisitButton bookingId={bookingId} visit={v} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {skipped.length > 0 && (
        <ul data-testid="skipped-instructions" className="flex flex-col gap-1">
          {skipped.map((s) => (
            <li key={s.id} className="rounded-md bg-stone-100 p-2 text-xs text-stone-700">
              <span className="font-medium">{s.label}</span> — {s.reason}
            </li>
          ))}
        </ul>
      )}

      {canGenerate && (
        <form action={regenAction} className="flex flex-col gap-2">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input
            type="hidden"
            name="confirmed"
            value={regenState.warning !== null ? 'true' : 'false'}
          />
          {regenState.error !== null && (
            <p role="alert" data-testid="regenerate-error" className="text-sm text-red-900">
              {regenState.error}
            </p>
          )}
          {regenState.warning !== null && (
            <p
              role="alert"
              data-testid="regenerate-warning"
              className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
            >
              {regenState.warning}
            </p>
          )}
          <button
            type="submit"
            data-testid={regenState.warning !== null ? 'confirm-regenerate' : 'regenerate-visits'}
            disabled={regenPending}
            className="self-start rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
          >
            {regenState.warning !== null ? 'Regenerate anyway' : 'Regenerate visits'}
          </button>
        </form>
      )}

      {adding ? (
        <form
          action={addAction}
          className="flex flex-col gap-2 rounded-md border border-stone-300 bg-white p-3"
        >
          <input type="hidden" name="bookingId" value={bookingId} />
          {addState.error !== null && (
            <p role="alert" data-testid="add-visit-error" className="text-sm text-red-900">
              {addState.error}
            </p>
          )}
          <label className="text-sm font-medium">Date</label>
          <input
            type="date"
            name="visitDate"
            data-testid="new-visit-date"
            required
            className={field}
          />
          <label className="text-sm font-medium">When</label>
          <select
            name="window"
            data-testid="new-visit-window"
            defaultValue="anytime"
            className={field}
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {WINDOW_LABELS[w]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            data-testid="save-new-visit"
            disabled={addPending}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Add visit
          </button>
        </form>
      ) : (
        <button
          type="button"
          data-testid="add-visit"
          onClick={() => setAdding(true)}
          className="self-start rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
        >
          Add visit
        </button>
      )}
    </div>
  )
}
