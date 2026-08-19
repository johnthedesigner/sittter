import { requireAdmin } from '../layout'

/**
 * The Phase 1 stub.
 *
 * It renders the signed-in admin's name and nothing else. That is the whole
 * point of it: the name comes from the database, reached through a session
 * cookie, which proves the chain end to end. The real home screen — today,
 * needs attention, filtered by acting admin — is Phase 2.
 */
export default async function HomePage() {
  const { admin } = await requireAdmin()

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="text-sm text-stone-600">Signed in as</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight" data-testid="admin-name">
        {admin.name}
      </h1>
      <p className="mt-1 text-sm text-stone-600" data-testid="admin-email">
        {admin.email}
      </p>
    </main>
  )
}
