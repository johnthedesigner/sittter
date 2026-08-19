/**
 * The Resend fake. Defined ONCE and shared.
 *
 * TESTS ONLY. `docs/dev-plan.md` §11.2 requires each vendor to be faked once
 * in a shared fixture rather than inline per test, so that a change in the
 * vendor's response shape fails in one place rather than in twenty.
 *
 * The fake stands in for the `resend` module itself, which is what proves
 * `src/services/email.ts` is the only thing reaching the vendor: nothing else
 * would notice this being replaced.
 */

export interface RecordedSend {
  from: string
  to: string
  subject: string
  html: string
}

export interface QueuedOutcome {
  kind: 'success' | 'throw' | 'error-response'
  message?: string
  id?: string
}

const state = {
  sends: [] as RecordedSend[],
  outcomes: [] as QueuedOutcome[],
  nextId: 0,
}

/** Every call the service made to the vendor, in order. */
export function recordedSends(): readonly RecordedSend[] {
  return state.sends
}

/**
 * Queue the outcomes the vendor will produce, one per call.
 *
 * Once the queue is empty, every further call succeeds. That default keeps a
 * test that only cares about the happy path from having to say so.
 */
export function queueOutcomes(...outcomes: QueuedOutcome[]): void {
  state.outcomes.push(...outcomes)
}

export function resetResendFake(): void {
  state.sends.length = 0
  state.outcomes.length = 0
  state.nextId = 0
}

/**
 * The replacement for the `resend` module.
 *
 * Passed to `vi.mock('resend', ...)`. Shaped like the real module's export
 * so the service under test cannot tell the difference.
 */
export function resendModuleFake() {
  return {
    Resend: class {
      readonly emails = {
        send: async (input: RecordedSend) => {
          state.sends.push(input)
          const outcome = state.outcomes.shift() ?? { kind: 'success' as const }

          if (outcome.kind === 'throw') {
            throw new Error(outcome.message ?? 'provider unavailable')
          }
          if (outcome.kind === 'error-response') {
            return { data: null, error: { message: outcome.message ?? 'rejected by provider' } }
          }

          state.nextId += 1
          return { data: { id: outcome.id ?? `fake-provider-id-${state.nextId}` }, error: null }
        },
      }
    },
  }
}
