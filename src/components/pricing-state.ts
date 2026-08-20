/**
 * Shared state shape for the pricing actions.
 *
 * Lives here, not beside the actions: a `'use server'` file may export only
 * async functions. See AGENTS.md, Patterns established.
 */
export interface PricingState {
  error: string | null
}

export const EMPTY_PRICING_STATE: PricingState = { error: null }
