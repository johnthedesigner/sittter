'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { createBooking, loadPropertiesForCustomer } from '@/app/(admin)/actions/bookings'
import type { CaptureState } from '@/app/(admin)/actions/bookings'

export interface CaptureCustomer {
  id: string
  name: string
}

/**
 * Fast capture.
 *
 * Built around one measurement: an admin who has used this before completes
 * it in under thirty seconds — a new customer name, a date range, and a
 * one-line note. Every decision here serves that.
 *
 *   The customer field is focused on load, so typing starts immediately.
 *   Typing a name that matches nothing offers to create it, in one tap.
 *   A customer with exactly one property has it chosen already.
 *   Entering dates turns "approximate" on without a second thought.
 *   Nothing but a customer name is required.
 */
export function CaptureForm({ customers }: { customers: CaptureCustomer[] }) {
  const [state, formAction, pending] = useActionState<CaptureState, FormData>(createBooking, {
    error: null,
  })

  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<CaptureCustomer | null>(null)
  const [properties, setProperties] = useState<{ id: string; nickname: string }[]>([])
  const [propertyId, setPropertyId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [approximate, setApproximate] = useState(false)
  const [touchedApproximate, setTouchedApproximate] = useState(false)

  const customerInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    customerInput.current?.focus()
  }, [])

  // Spec §5.1: "Dates are approximate" defaults on once dates are entered.
  useEffect(() => {
    if (!touchedApproximate && startDate !== '' && endDate !== '') setApproximate(true)
  }, [startDate, endDate, touchedApproximate])

  useEffect(() => {
    // A customer chosen via "create new" has no id yet, so there is nothing
    // to look up — and asking would send an empty string where a uuid is
    // expected, which fails as an opaque query error rather than a no-op.
    if (chosen === null || chosen.id === '') {
      setProperties([])
      setPropertyId('')
      return
    }
    let cancelled = false
    void loadPropertiesForCustomer(chosen.id).then((rows) => {
      if (cancelled) return
      setProperties(rows)
      // Exactly one property is chosen for you; more than one is a choice.
      setPropertyId(rows.length === 1 ? (rows[0]?.id ?? '') : '')
    })
    return () => {
      cancelled = true
    }
  }, [chosen])

  const matches = useMemo(() => {
    if (query.trim() === '') return []
    const needle = query.trim().toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 6)
  }, [customers, query])

  const exactMatch = matches.some((m) => m.name.toLowerCase() === query.trim().toLowerCase())
  const offerCreate = query.trim() !== '' && chosen === null && !exactMatch

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      {state.error !== null && (
        <p
          role="alert"
          data-testid="capture-error"
          className="rounded-md bg-red-50 p-3 text-sm text-red-900"
        >
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="customer" className="text-sm font-medium">
          Customer
        </label>
        {chosen === null ? (
          <>
            <input
              id="customer"
              ref={customerInput}
              data-testid="customer-input"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base"
            />
            {(matches.length > 0 || offerCreate) && (
              <ul data-testid="customer-options" className="mt-1 flex flex-col gap-1">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      data-testid="customer-option"
                      onClick={() => {
                        setChosen(m)
                        setQuery(m.name)
                      }}
                      className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm"
                    >
                      {m.name}
                    </button>
                  </li>
                ))}
                {offerCreate && (
                  <li>
                    <button
                      type="button"
                      data-testid="create-customer-option"
                      onClick={() => setChosen({ id: '', name: query.trim() })}
                      className="w-full rounded-md border border-dashed border-stone-400 px-3 py-2 text-left text-sm"
                    >
                      {`Create new customer "${query.trim()}"`}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-stone-300 bg-white px-3 py-2">
            <span data-testid="chosen-customer" className="text-base">
              {chosen.name}
            </span>
            <button
              type="button"
              data-testid="change-customer"
              onClick={() => {
                setChosen(null)
                setQuery('')
              }}
              className="text-sm underline"
            >
              Change
            </button>
          </div>
        )}
        {/*
          Both hidden fields live OUTSIDE the branch above. Rendering the
          name field only while no customer is chosen meant it vanished the
          moment "create new" was tapped — so the form submitted neither an
          id nor a name, and the server correctly said a customer name was
          required for a form that plainly had one.
        */}
        <input type="hidden" name="customerId" value={chosen?.id ?? ''} />
        <input
          type="hidden"
          name="newCustomerName"
          value={chosen === null ? query.trim() : chosen.id === '' ? chosen.name : ''}
        />
      </div>

      {chosen !== null && (
        <div>
          <label htmlFor="propertyId" className="text-sm font-medium">
            Property
          </label>
          <select
            id="propertyId"
            name="propertyId"
            data-testid="property-select"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base"
          >
            <option value="">New property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="startDate" className="text-sm font-medium">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            data-testid="start-date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="text-sm font-medium">
            End date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            data-testid="end-date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="datesApproximate"
          data-testid="dates-approximate"
          checked={approximate}
          onChange={(e) => {
            setApproximate(e.target.checked)
            setTouchedApproximate(true)
          }}
          className="h-5 w-5"
        />
        Dates are approximate
      </label>

      <div>
        <label htmlFor="note" className="text-sm font-medium">
          Note
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          data-testid="note"
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base"
        />
      </div>

      <button
        type="submit"
        data-testid="save-booking"
        disabled={pending}
        className="rounded-md bg-stone-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
