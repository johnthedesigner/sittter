/**
 * Activity source labels, fixed in `tasks/phase-2.md` Reference data.
 *
 * Importing nothing, so tests can assert on them directly.
 */

import type { ActivitySource } from '@/core/types'

export const ACTIVITY_SOURCE_LABELS: Record<ActivitySource, string> = {
  text_message: 'Text message',
  in_person: 'In person',
  email: 'Email',
  phone: 'Phone',
  customer_form: 'Customer form',
  app: 'In the app',
}
