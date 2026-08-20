/**
 * Journey 1 — A neighbor asks in person, and the booking becomes confirmed.
 * Covers docs/user-journeys.md steps 1.1.1 and 1.3.2 so far.
 *
 * Later steps arrive with the tasks that build them: 1.1.2–1.1.7 in Task 2.2,
 * 1.2.x in Task 2.3, 1.3.1–1.3.5 in Task 2.4, 1.3.6 in Task 2.5.
 */

import { ADMIN_STATUS_LABELS } from '../src/components/status'
import { expect, signedInTest as test } from './fixtures'

test('1.1.1 — the home screen shows today and a needs-attention list', async ({ page }) => {
  await page.goto('/home')

  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByTestId('today-section')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible()
  await expect(page.getByTestId('attention-section')).toBeVisible()
})

test('1.1.1 — a "New booking" action is reachable without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/home')

  const action = page.getByTestId('new-booking')
  await expect(action).toBeVisible()
  await expect(action).toBeInViewport()
})

test('the seeded needs-attention list surfaces the tentative booking', async ({ page }) => {
  // The seed has one booking with datesFirmAt set and availabilityCheckedAt
  // null, so exactly one calendar-check item is expected.
  await page.goto('/home')
  const kinds = await page
    .getByTestId('attention-item')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-kind')))
  expect(kinds).toContain('missing_availability_check')
})

test('1.3.2 — the booking list shows both confirmation flags as columns', async ({ page }) => {
  await page.goto('/bookings')

  const rows = page.getByTestId('booking-row')
  await expect(rows).toHaveCount(3) // the seed: confirmed, tentative, inquiry

  // Every row carries both flags, so which one is missing is readable here.
  for (let i = 0; i < 3; i += 1) {
    await expect(rows.nth(i).getByTestId('flag-indicator')).toHaveCount(2)
  }
})

test('1.3.2 — one flag set and one unset is visible without opening the booking', async ({
  page,
}) => {
  await page.goto('/bookings?status=tentative')

  const row = page.getByTestId('booking-row').first()
  const flags = row.getByTestId('flag-indicator')

  await expect(flags.filter({ has: page.locator('[data-set="true"]') })).toHaveCount(0)
  const states = await flags.evaluateAll((nodes) =>
    nodes.map((n) => `${n.getAttribute('data-flag')}=${n.getAttribute('data-set')}`)
  )
  expect(states).toEqual(['Dates firm=true', 'Calendar checked=false'])
})

test('the list renders every seeded status from deriveStatus', async ({ page }) => {
  await page.goto('/bookings')
  const statuses = await page
    .getByTestId('status-chip')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-status')))
  expect([...statuses].sort()).toEqual(['confirmed', 'inquiry', 'tentative'])
})

test('status labels match the reference data', async ({ page }) => {
  await page.goto('/bookings')
  const chips = page.getByTestId('status-chip')
  const count = await chips.count()
  for (let i = 0; i < count; i += 1) {
    const status = await chips.nth(i).getAttribute('data-status')
    await expect(chips.nth(i)).toHaveText(
      ADMIN_STATUS_LABELS[status as keyof typeof ADMIN_STATUS_LABELS]
    )
  }
})

test('the status filter narrows the list and survives a reload', async ({ page }) => {
  await page.goto('/bookings?status=inquiry')
  await expect(page.getByTestId('booking-row')).toHaveCount(1)

  await page.reload()
  await expect(page.getByTestId('booking-row')).toHaveCount(1)
  await expect(
    page.locator('[data-testid="status-filter"] [data-status="inquiry"]')
  ).toHaveAttribute('data-active', 'true')
})

test('a filter matching nothing says so rather than showing an empty page', async ({ page }) => {
  await page.goto('/bookings?status=cancelled')
  await expect(page.getByTestId('booking-row')).toHaveCount(0)
  await expect(page.getByTestId('empty-list')).toBeVisible()
})

test('the admin surface does not scroll horizontally on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/home', '/bookings', '/customers']) {
    await page.goto(path)
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflows, `${path} scrolls horizontally at 390px`).toBe(false)
  }
})

test('the acting admin is shown in the shell', async ({ page }) => {
  await page.goto('/home')
  await expect(page.getByTestId('acting-admin')).toHaveText('Sitter')
})
