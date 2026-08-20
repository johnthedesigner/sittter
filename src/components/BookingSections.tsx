'use client'

import { useActionState, useState } from 'react'

import { updateBookingDates, updateProperty } from '@/app/(admin)/actions/bookings'
import type { CaptureState } from '@/app/(admin)/actions/bookings'
import {
  deleteCareInstructionAction,
  saveCareInstruction,
} from '@/app/(admin)/actions/care-instructions'
import type { InstructionState } from '@/app/(admin)/actions/care-instructions'
import type { Cadence } from '@/core/types'

import { CADENCE_LABELS, CADENCE_ORDER } from './cadence'

const field = 'mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base'
const primary = 'rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white'

export function DatesSection({
  bookingId,
  startDate,
  endDate,
  datesApproximate,
}: {
  bookingId: string
  startDate: string | null
  endDate: string | null
  datesApproximate: boolean
}) {
  const [state, action, pending] = useActionState<CaptureState, FormData>(updateBookingDates, {
    error: null,
  })

  return (
    <form action={action} data-testid="dates-form" className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state.error !== null && (
        <p
          role="alert"
          data-testid="dates-error"
          className="rounded-md bg-red-50 p-3 text-sm text-red-900"
        >
          {state.error}
        </p>
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
            data-testid="detail-start-date"
            defaultValue={startDate ?? ''}
            className={field}
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
            data-testid="detail-end-date"
            defaultValue={endDate ?? ''}
            className={field}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="datesApproximate"
          data-testid="detail-approximate"
          defaultChecked={datesApproximate}
          className="h-5 w-5"
        />
        Dates are approximate
      </label>
      <button type="submit" data-testid="save-dates" disabled={pending} className={primary}>
        {pending ? 'Saving…' : 'Save dates'}
      </button>
    </form>
  )
}

export interface InstructionView {
  id: string
  label: string
  detail: string | null
  cadence: Cadence
  cadenceCustom: string | null
  weatherRelevant: boolean
  sortOrder: number
  isOverride: boolean
  shadowsLabel: string | null
}

function InstructionForm({
  bookingId,
  propertyId,
  instruction,
  onDone,
}: {
  bookingId: string
  propertyId: string
  instruction: InstructionView | null
  onDone?: () => void
}) {
  const [state, action, pending] = useActionState<InstructionState, FormData>(saveCareInstruction, {
    error: null,
  })
  const [cadence, setCadence] = useState<Cadence>(instruction?.cadence ?? 'every_day')

  return (
    <form
      action={async (formData: FormData) => {
        await action(formData)
        onDone?.()
      }}
      data-testid="instruction-form"
      className="flex flex-col gap-2 rounded-md border border-stone-300 bg-white p-3"
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="instructionId" value={instruction?.id ?? ''} />
      <input type="hidden" name="sortOrder" value={instruction?.sortOrder ?? 0} />

      {state.error !== null && (
        <p role="alert" data-testid="instruction-error" className="text-sm text-red-900">
          {state.error}
        </p>
      )}

      <label className="text-sm font-medium" htmlFor={`label-${instruction?.id ?? 'new'}`}>
        Label
      </label>
      <input
        id={`label-${instruction?.id ?? 'new'}`}
        name="label"
        data-testid="instruction-label"
        defaultValue={instruction?.label ?? ''}
        required
        className={field}
      />

      <label className="text-sm font-medium">Detail</label>
      <textarea
        name="detail"
        rows={2}
        data-testid="instruction-detail"
        defaultValue={instruction?.detail ?? ''}
        className={field}
      />

      <label className="text-sm font-medium">Cadence</label>
      <select
        name="cadence"
        data-testid="instruction-cadence"
        value={cadence}
        onChange={(e) => setCadence(e.target.value as Cadence)}
        className={field}
      >
        {CADENCE_ORDER.map((c) => (
          <option key={c} value={c}>
            {CADENCE_LABELS[c]}
          </option>
        ))}
      </select>

      {cadence === 'custom' && (
        <input
          name="cadenceCustom"
          data-testid="instruction-cadence-custom"
          placeholder="Describe the cadence"
          defaultValue={instruction?.cadenceCustom ?? ''}
          className={field}
        />
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="weatherRelevant"
          data-testid="instruction-weather"
          defaultChecked={instruction?.weatherRelevant ?? false}
          className="h-5 w-5"
        />
        Weather relevant
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="bookingOnly"
          data-testid="instruction-booking-only"
          defaultChecked={instruction?.isOverride ?? false}
          className="h-5 w-5"
        />
        This booking only
      </label>

      <button type="submit" data-testid="save-instruction" disabled={pending} className={primary}>
        {pending ? 'Saving…' : 'Save instruction'}
      </button>
    </form>
  )
}

export function CareInstructionsSection({
  bookingId,
  propertyId,
  instructions,
}: {
  bookingId: string
  propertyId: string
  instructions: InstructionView[]
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="mt-3 flex flex-col gap-2">
      {instructions.length === 0 && !adding && (
        <p data-testid="no-instructions" className="text-sm text-stone-600">
          No care instructions yet.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {instructions.map((i) => (
          <li
            key={i.id}
            data-testid="instruction"
            data-override={i.isOverride ? 'true' : 'false'}
            data-cadence={i.cadence}
            className="rounded-md border border-stone-200 bg-white p-3"
          >
            {editing === i.id ? (
              <InstructionForm
                bookingId={bookingId}
                propertyId={propertyId}
                instruction={i}
                onDone={() => setEditing(null)}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium" data-testid="instruction-name">
                      {i.label}
                    </p>
                    {i.detail !== null && <p className="text-sm text-stone-600">{i.detail}</p>}
                    <p className="mt-1 text-xs text-stone-500">
                      {CADENCE_LABELS[i.cadence]}
                      {i.cadence === 'custom' &&
                        i.cadenceCustom !== null &&
                        ` — ${i.cadenceCustom}`}
                      {i.weatherRelevant && ' · weather relevant'}
                    </p>
                    {i.isOverride && (
                      <p
                        className="mt-1 text-xs font-medium text-amber-800"
                        data-testid="override-badge"
                      >
                        This booking only
                        {i.shadowsLabel !== null &&
                          ` — replaces the property's "${i.shadowsLabel}"`}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      data-testid="edit-instruction"
                      onClick={() => setEditing(i.id)}
                      className="text-sm underline"
                    >
                      Edit
                    </button>
                    <form action={deleteCareInstructionAction}>
                      <input type="hidden" name="bookingId" value={bookingId} />
                      <input type="hidden" name="instructionId" value={i.id} />
                      <button
                        type="submit"
                        data-testid="delete-instruction"
                        className="text-sm underline"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <InstructionForm
          bookingId={bookingId}
          propertyId={propertyId}
          instruction={null}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          data-testid="add-instruction"
          onClick={() => setAdding(true)}
          className="self-start rounded-md border border-stone-300 px-3 py-2 text-sm font-medium"
        >
          Add instruction
        </button>
      )}
    </div>
  )
}

export function PropertySection({
  bookingId,
  propertyId,
  nickname,
  address,
  accessNotes,
  accessCodes,
}: {
  bookingId: string
  propertyId: string
  nickname: string
  address: string | null
  accessNotes: string | null
  accessCodes: string | null
}) {
  const [state, action, pending] = useActionState<CaptureState, FormData>(updateProperty, {
    error: null,
  })

  return (
    <form action={action} data-testid="property-form" className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="propertyId" value={propertyId} />
      {state.error !== null && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="nickname" className="text-sm font-medium">
          Nickname
        </label>
        <input
          id="nickname"
          name="nickname"
          data-testid="property-nickname"
          defaultValue={nickname}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="address" className="text-sm font-medium">
          Address
        </label>
        <input
          id="address"
          name="address"
          data-testid="property-address"
          defaultValue={address ?? ''}
          className={field}
        />
      </div>

      {/*
        Access details are ADMIN ONLY and are labelled as such on screen —
        journey step 1.2.5. The label is not decoration: it is how an admin
        knows a garage code is safe to type here. The customer-facing reads in
        src/db/repositories/properties.ts name their columns and cannot return
        either of these fields.
      */}
      <fieldset
        data-testid="admin-only-fields"
        className="rounded-md border border-amber-300 bg-amber-50 p-3"
      >
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
          Admin only — never shown to the customer
        </legend>
        <div className="mt-1">
          <label htmlFor="accessCodes" className="text-sm font-medium">
            Access codes
          </label>
          <input
            id="accessCodes"
            name="accessCodes"
            data-testid="property-access-codes"
            defaultValue={accessCodes ?? ''}
            className={field}
          />
        </div>
        <div className="mt-2">
          <label htmlFor="accessNotes" className="text-sm font-medium">
            Access notes
          </label>
          <textarea
            id="accessNotes"
            name="accessNotes"
            rows={2}
            data-testid="property-access-notes"
            defaultValue={accessNotes ?? ''}
            className={field}
          />
        </div>
      </fieldset>

      <button type="submit" data-testid="save-property" disabled={pending} className={primary}>
        {pending ? 'Saving…' : 'Save property'}
      </button>
    </form>
  )
}
