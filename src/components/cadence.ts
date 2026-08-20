/**
 * Cadence labels, fixed in `tasks/phase-2.md` Reference data.
 *
 * `Custom` stores free text and does not participate in visit generation —
 * `src/core/schedule.ts` returns it in `skippedInstructions` with a reason,
 * and a surface shows that reason rather than writing a second one.
 */

import type { Cadence } from '@/core/types'

export const CADENCE_LABELS: Record<Cadence, string> = {
  every_day: 'Every day',
  every_other_day: 'Every other day',
  every_third_day: 'Every third day',
  once_at_start: 'Once at the start',
  once_at_end: 'Once at the end',
  as_needed: 'As needed',
  custom: 'Custom',
}

/** Offered in the order the spec lists them. */
export const CADENCE_ORDER: Cadence[] = [
  'every_day',
  'every_other_day',
  'every_third_day',
  'once_at_start',
  'once_at_end',
  'as_needed',
  'custom',
]
