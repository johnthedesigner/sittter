/**
 * Sign-in copy, fixed in `tasks/phase-1.md` Reference data.
 *
 * Kept in its own module, importing nothing, so a test can assert on the
 * exact strings without pulling the server-component graph — and its Next
 * imports — into the test process.
 *
 * The confirmation message is shown whether or not the address belongs to an
 * admin. `docs/user-journeys.md` step 8.1.5 requires that, which is why there
 * is no "no such admin" string here: there is no such state.
 */
export const SIGN_IN_COPY = {
  heading: 'Sign in',
  emailLabel: 'Email address',
  submit: 'Send me a link',
  sent: 'If that address belongs to an admin, a sign-in link is on its way. It expires in 15 minutes.',
  invalid:
    'That sign-in link is no longer valid. Links expire after 15 minutes and can only be used once.',
  invalidAction: 'Request a new link',
} as const
