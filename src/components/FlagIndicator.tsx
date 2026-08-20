/**
 * One of the two confirmation flags.
 *
 * Both are shown on the booking list as their own columns, so an admin can
 * see WHICH of the two is missing without opening the booking — `docs/spec.md`
 * §5.5 requires exactly that.
 *
 * Set and unset are distinguished by more than colour, because "which flag is
 * missing" is the question this element exists to answer.
 */
export function FlagIndicator({
  set,
  label,
  attribution,
}: {
  set: boolean
  label: string
  attribution?: string | null
}) {
  return (
    <span
      data-testid="flag-indicator"
      data-flag={label}
      data-set={set ? 'true' : 'false'}
      title={attribution ?? label}
      className={`inline-flex items-center gap-1 text-xs ${set ? 'text-emerald-800' : 'text-stone-400'}`}
    >
      <span aria-hidden="true">{set ? '✓' : '—'}</span>
      <span className="sr-only">{`${label}: ${set ? 'set' : 'not set'}`}</span>
      {attribution !== undefined && attribution !== null && (
        <span className="hidden sm:inline">{attribution}</span>
      )}
    </span>
  )
}
