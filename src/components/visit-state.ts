/**
 * Shared state shape for the visit actions.
 *
 * Lives here rather than beside the actions because a `'use server'` file may
 * export ONLY async functions. Exporting a plain constant from one fails at
 * runtime with "A 'use server' file can only export async functions, found
 * object" — and it takes down every module that imports it, so the symptom
 * appears far from the cause.
 */
export interface VisitState {
  error: string | null
  /** Set when a destructive action needs a second, explicit confirmation. */
  warning: string | null
}

export const EMPTY_VISIT_STATE: VisitState = { error: null, warning: null }
