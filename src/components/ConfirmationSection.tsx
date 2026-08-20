'use client'

import { useActionState } from 'react'

import {
  cancelBookingAction,
  declineBookingAction,
  markPaidAction,
  toggleAvailabilityChecked,
  toggleDatesFirm,
} from '@/app/(admin)/actions/confirmation'
import type { ConfirmationState } from '@/app/(admin)/actions/confirmation'

/**
 * The two confirmation controls — `docs/spec.md` §5.5.
 *
 * They are TWO INDEPENDENT ACTIONS, and this component's whole shape serves
 * that. Each is its own `<form>` containing nothing but the booking
 * identifier and the value being set. There is no shared save button and no
 * field either form could carry on the other's behalf.
 *
 * The second one, "Checked the family calendar", must never be combined with
 * any other change into a single save. That rule is UNDER REVIEW in
 * `docs/spec.md` §10 — it encodes deliberateness as a hard constraint and may
 * be more friction than it is worth. It is built exactly as specified and is
 * not to be relaxed here; the human decides against live use.
 */

const toggleClass = (set: boolean) =>
  `w-full rounded-md px-4 py-3 text-left text-base font-medium ${
    set ? 'bg-emerald-100 text-emerald-950' : 'border border-stone-300 bg-white'
  }`

export function ConfirmationSection({
  bookingId,
  datesFirm,
  datesFirmAttribution,
  availabilityChecked,
  availabilityAttribution,
}: {
  bookingId: string
  datesFirm: boolean
  datesFirmAttribution: string | null
  availabilityChecked: boolean
  availabilityAttribution: string | null
}) {
  return (
    <div className="mt-3 flex flex-col gap-6">
      {/* Control one. Its own form. */}
      <form action={toggleDatesFirm} data-testid="dates-firm-form">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="value" value={datesFirm ? 'false' : 'true'} />
        <button type="submit" data-testid="toggle-dates-firm" className={toggleClass(datesFirm)}>
          <span aria-hidden="true" className="mr-2">
            {datesFirm ? '✓' : '○'}
          </span>
          Customer&rsquo;s dates are firm
        </button>
        {datesFirmAttribution !== null && (
          <p className="mt-1 text-xs text-stone-600" data-testid="dates-firm-attribution">
            {datesFirmAttribution}
          </p>
        )}
      </form>

      {/*
        A visible separator, not just a margin. Spec §5.5 asks for the two
        controls to be visually and physically separated, so that setting one
        cannot be mistaken for setting both.
      */}
      <hr data-testid="confirmation-separator" className="border-stone-300" />

      {/* Control two. Its own form, and its own submission. */}
      <form action={toggleAvailabilityChecked} data-testid="availability-form">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="value" value={availabilityChecked ? 'false' : 'true'} />
        <button
          type="submit"
          data-testid="toggle-availability"
          className={toggleClass(availabilityChecked)}
        >
          <span aria-hidden="true" className="mr-2">
            {availabilityChecked ? '✓' : '○'}
          </span>
          Checked the family calendar
        </button>
        {availabilityAttribution !== null && (
          <p className="mt-1 text-xs text-stone-600" data-testid="availability-attribution">
            {availabilityAttribution}
          </p>
        )}
      </form>
    </div>
  )
}

export function PaymentSection({
  bookingId,
  paidAt,
  paidMethodNote,
}: {
  bookingId: string
  paidAt: string | null
  paidMethodNote: string | null
}) {
  const [state, action, pending] = useActionState<ConfirmationState, FormData>(markPaidAction, {
    error: null,
  })

  return (
    <form action={action} data-testid="payment-form" className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state.error !== null && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="paidOn" className="text-sm font-medium">
          Paid on
        </label>
        <input
          id="paidOn"
          name="paidOn"
          type="date"
          data-testid="paid-on"
          defaultValue={paidAt ?? ''}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="paidMethodNote" className="text-sm font-medium">
          How
        </label>
        <input
          id="paidMethodNote"
          name="paidMethodNote"
          data-testid="paid-method"
          defaultValue={paidMethodNote ?? ''}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base"
        />
      </div>
      <button
        type="submit"
        data-testid="mark-paid"
        disabled={pending}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
      >
        {pending ? 'Saving…' : 'Mark paid'}
      </button>
    </form>
  )
}

export function TerminalActions({ bookingId }: { bookingId: string }) {
  return (
    <div className="mt-3 flex gap-3">
      <form action={declineBookingAction}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <button
          type="submit"
          data-testid="decline-booking"
          className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
        >
          Decline
        </button>
      </form>
      <form action={cancelBookingAction}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <button
          type="submit"
          data-testid="cancel-booking"
          className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
        >
          Cancel
        </button>
      </form>
    </div>
  )
}
