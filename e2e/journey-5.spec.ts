/**
 * Journey 5 — A customer follows what is happening.
 * Covers docs/user-journeys.md step 5.3.2 so far.
 *
 * These are the first specs in the suite that visit a page WITHOUT signing
 * in. `test` is used rather than `signedInTest` deliberately: a customer has
 * no account, and a spec that happened to be authenticated would not be
 * testing what a customer sees.
 */

import { randomBytes } from 'node:crypto'

import { INVALID_LINK_COPY } from '../src/components/link-copy'
import { expect, test } from './fixtures'
import {
  ACCESS_CODE_FIXTURE,
  linkFor,
  revokedLinkFor,
  expiredLinkFor,
  seededCustomerIds,
} from './fixtures'

test('a live portal link shows that customer’s engagements', async ({ page }) => {
  const { slug } = await linkFor('customer_portal')
  await page.goto(`/s/${slug}`)

  await expect(page.getByTestId('portal-view')).toBeVisible()
  await expect(page.getByTestId('portal-customer')).toHaveText('Dana Whitfield')
  await expect(page.getByTestId('portal-engagement').first()).toBeVisible()
})

test('the URL stays /s/<slug> so the customer can bookmark it', async ({ page }) => {
  const { slug } = await linkFor('customer_portal')
  await page.goto(`/s/${slug}`)
  await expect(page).toHaveURL(new RegExp(`/s/${slug}$`))
})

test('resolution is case-insensitive in the browser, not only in a unit test', async ({ page }) => {
  const { slug } = await linkFor('customer_portal')
  await page.goto(`/s/${slug.toLowerCase()}`)
  await expect(page.getByTestId('portal-view')).toBeVisible()
})

test('5.3.2 — A REVOKED, AN EXPIRED, AND A NEVER-EXISTENT SLUG ARE IDENTICAL', async ({ page }) => {
  const revoked = await revokedLinkFor()
  const expired = await expiredLinkFor()
  const nonexistent = randomBytes(4)
    .toString('hex')
    .slice(0, 5)
    .toUpperCase()
    .replace(/[ILOU]/g, 'X')

  const seen: { status: number | undefined; body: string }[] = []
  for (const slug of [revoked, expired, nonexistent]) {
    const response = await page.goto(`/s/${slug}`)
    seen.push({
      status: response?.status(),
      body: (await page.locator('main').innerText()).replace(/\s+/g, ' ').trim(),
    })
  }

  // Same status, same words. Any difference is a probe.
  expect(seen[0]!.status).toBe(404)
  expect(seen[1]!.status).toBe(seen[0]!.status)
  expect(seen[2]!.status).toBe(seen[0]!.status)
  expect(seen[1]!.body).toBe(seen[0]!.body)
  expect(seen[2]!.body).toBe(seen[0]!.body)
})

test('the invalid-link page uses the exact copy and names no slug', async ({ page }) => {
  const revoked = await revokedLinkFor()
  await page.goto(`/s/${revoked}`)

  await expect(page.getByTestId('invalid-link-heading')).toHaveText(INVALID_LINK_COPY.heading)
  await expect(page.getByTestId('invalid-link-body')).toHaveText(INVALID_LINK_COPY.body)
  await expect(page.getByTestId('invalid-link-contact')).toBeVisible()

  const body = await page.locator('main').innerText()
  expect(body).not.toContain(revoked)
  expect(body).not.toMatch(/expired|revoked|does not exist|not found/i)
})

test('a malformed slug lands on the same page', async ({ page }) => {
  const response = await page.goto('/s/AB3I9') // I is not in the alphabet
  expect(response?.status()).toBe(404)
  await expect(page.getByTestId('invalid-link-heading')).toBeVisible()
})

test('a public intake link sends the visitor to the intake form', async ({ page }) => {
  const { slug } = await linkFor('public_intake')
  await page.goto(`/s/${slug}`)
  // /new is built in Task 3.3; the dispatch is what is under test here.
  await expect(page).toHaveURL(/\/new$/)
})

test('a booking form link shows that booking while it is still tentative', async ({ page }) => {
  const { slug } = await linkFor('booking_form')
  await page.goto(`/s/${slug}`)
  await expect(page.getByTestId('booking-form-view')).toBeVisible()
  await expect(page.getByTestId('portal-range')).toBeVisible()
})

test('NO PUBLIC PAGE RENDERS THE ADMIN SHELL', async ({ page }) => {
  const { slug } = await linkFor('customer_portal')
  await page.goto(`/s/${slug}`)

  // The admin navigation, the acting-admin name, and the New booking action
  // are all absent — this page is not behind the session guard and must not
  // look as though it is.
  await expect(page.getByTestId('primary-nav')).toHaveCount(0)
  await expect(page.getByTestId('acting-admin')).toHaveCount(0)
  await expect(page.getByTestId('new-booking')).toHaveCount(0)
})

test('THE PORTAL LEAKS NO ACCESS CODE, ACTIVITY ENTRY, OR ADMIN NAME', async ({ page }) => {
  // The phase gate's own check, as a test. The seed puts a known access code
  // on the property and the admin's name on system activity entries.
  const { slug } = await linkFor('customer_portal')
  await page.goto(`/s/${slug}`)

  const html = await page.content()
  expect(html).not.toContain(ACCESS_CODE_FIXTURE)
  expect(html).not.toContain('Side door sticks')
  expect(html).not.toContain('Sitter')
  expect(html).not.toMatch(/created this booking|checked the family calendar/i)
})

test('a portal shows only that customer’s engagements', async ({ page }) => {
  const { first, second } = await seededCustomerIds()
  const { slug } = await linkFor('customer_portal', first)
  await page.goto(`/s/${slug}`)

  const shown = await page
    .getByTestId('portal-engagement')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-booking-id')))

  const { slug: otherSlug } = await linkFor('customer_portal', second)
  await page.goto(`/s/${otherSlug}`)
  const otherShown = await page
    .getByTestId('portal-engagement')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-booking-id')))

  for (const id of otherShown) expect(shown).not.toContain(id)
})

test('no internal status name appears on a customer surface', async ({ page }) => {
  const { slug } = await linkFor('customer_portal')
  await page.goto(`/s/${slug}`)
  const html = await page.content()
  for (const internal of ['inquiry', 'tentative', 'in_progress', 'closed', 'declined']) {
    expect(html.toLowerCase()).not.toContain(internal)
  }
})
