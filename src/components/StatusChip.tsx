import { ADMIN_STATUS_CLASSES, ADMIN_STATUS_LABELS } from './status'
import type { BookingStatus } from '@/core/types'

/**
 * A booking's status.
 *
 * Takes an already-derived status rather than a booking, so there is no way
 * to render a status this component computed itself. `deriveStatus` is the
 * single source of truth. See AGENTS.md.
 */
export function StatusChip({ status }: { status: BookingStatus }) {
  return (
    <span
      data-testid="status-chip"
      data-status={status}
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ADMIN_STATUS_CLASSES[status]}`}
    >
      {ADMIN_STATUS_LABELS[status]}
    </span>
  )
}
