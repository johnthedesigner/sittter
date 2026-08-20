/**
 * Admin-facing status labels.
 *
 * Fixed in `tasks/phase-2.md` Reference data. These are the INTERNAL status
 * names, which only admins see. Customers get `toCustomerFacingLabel` from
 * `src/core/presentation.ts`, and there is no customer surface in Phase 2.
 *
 * Importing nothing, so a test can assert on these without pulling a server
 * component's dependencies into the test process.
 */

import type { BookingStatus } from '@/core/types'

export const ADMIN_STATUS_LABELS: Record<BookingStatus, string> = {
  inquiry: 'Inquiry',
  tentative: 'Tentative',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  complete: 'Complete',
  closed: 'Closed',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

/** Tailwind classes per status. Muted for terminal states, stronger for live ones. */
export const ADMIN_STATUS_CLASSES: Record<BookingStatus, string> = {
  inquiry: 'bg-stone-200 text-stone-700',
  tentative: 'bg-amber-100 text-amber-900',
  confirmed: 'bg-emerald-100 text-emerald-900',
  in_progress: 'bg-sky-100 text-sky-900',
  complete: 'bg-stone-200 text-stone-700',
  closed: 'bg-stone-200 text-stone-600',
  declined: 'bg-stone-200 text-stone-600',
  cancelled: 'bg-stone-200 text-stone-600',
}

/** Statuses offered as filters on the booking list, in a sensible order. */
export const FILTERABLE_STATUSES: BookingStatus[] = [
  'inquiry',
  'tentative',
  'confirmed',
  'in_progress',
  'complete',
  'closed',
  'declined',
  'cancelled',
]
