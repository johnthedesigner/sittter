import { requestSignInLink } from '../(admin)/actions/auth'
import { SIGN_IN_COPY as COPY } from './copy'

/**
 * The sign-in page. Copy lives in ./copy.ts so tests can assert on it without
 * importing this component's Next dependencies.
 */

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; invalid?: string }>
}) {
  const params = await searchParams
  const sent = params.sent === '1'
  const invalid = params.invalid === '1'

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{COPY.heading}</h1>

      {invalid && (
        <div
          role="status"
          className="mt-6 rounded-md border border-stone-300 bg-white p-4 text-sm leading-6"
        >
          <p>{COPY.invalid}</p>
        </div>
      )}

      {sent ? (
        <div
          role="status"
          className="mt-6 rounded-md border border-stone-300 bg-white p-4 text-sm leading-6"
        >
          <p>{COPY.sent}</p>
        </div>
      ) : (
        <form action={requestSignInLink} className="mt-6 flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">
            {COPY.emailLabel}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-base"
          />
          <button
            type="submit"
            className="rounded-md bg-stone-900 px-4 py-2 text-base font-semibold text-white"
          >
            {COPY.submit}
          </button>
        </form>
      )}

      {(sent || invalid) && (
        <a href="/signin" className="mt-6 text-sm font-medium underline">
          {COPY.invalidAction}
        </a>
      )}
    </main>
  )
}
