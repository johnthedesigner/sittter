import { RATE_LIMITED_COPY } from '@/components/link-copy'

/**
 * Shown when slug resolution is rate limited.
 *
 * Says nothing about any slug — a caller who has hit the limit learns only
 * that they have hit the limit.
 */
export default function RateLimitedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight" data-testid="rate-limited-heading">
        {RATE_LIMITED_COPY.heading}
      </h1>
      <p className="mt-4 text-base leading-7">{RATE_LIMITED_COPY.body}</p>
    </main>
  )
}
