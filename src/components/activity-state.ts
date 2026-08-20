/**
 * Shared state for the activity action. Separate module because a
 * `'use server'` file may export only async functions.
 */
export interface ActivityState {
  error: string | null
}

export const EMPTY_ACTIVITY_STATE: ActivityState = { error: null }
