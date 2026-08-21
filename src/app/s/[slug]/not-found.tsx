import { getOnlyBusiness } from '@/db/repositories/businesses'
import { INVALID_LINK_COPY } from '@/components/link-copy'

/**
 * The invalid-link page. Rendered with a 404 by `notFound()`.
 *
 * Every dead link lands here: a slug that never existed, one that expired,
 * one that was revoked, and one belonging to another business. The page names
 * no slug and says nothing about which case occurred, because it is reachable
 * by anyone and the difference is exactly what a prober is looking for.
 */
export default async function InvalidLinkPage() {
  const business = await getOnlyBusiness()

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight" data-testid="invalid-link-heading">
        {INVALID_LINK_COPY.heading}
      </h1>
      <p className="mt-4 text-base leading-7" data-testid="invalid-link-body">
        {INVALID_LINK_COPY.body}
      </p>
      {business !== null && (
        <p className="mt-6 text-base">
          <a href={`mailto:${business.contactEmail}`} data-testid="invalid-link-contact">
            {business.contactEmail}
          </a>
        </p>
      )}
    </main>
  )
}
