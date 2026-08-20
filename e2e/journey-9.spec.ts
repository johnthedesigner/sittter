/**
 * Journey 9 — An engagement that does not fit the standard pricing.
 * Covers docs/user-journeys.md steps 9.1.1 through 9.1.7.
 */

import { expect, signedInTest as test } from './fixtures'

/** The seeded confirmed booking, with visits generated and pricing snapshotted. */
async function confirmedBooking(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/bookings?status=confirmed')
  await page.getByTestId('booking-row').first().getByRole('link').first().click()
  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)
  return page.url()
}

/** Confirm the tentative booking, which snapshots its pricing. */
async function newlyConfirmed(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/bookings?status=tentative')
  await page.getByTestId('booking-row').first().getByRole('link').first().click()
  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)
  await page.getByTestId('toggle-availability').click()
  // Confirming now also generates visits and snapshots pricing, so wait for
  // the write to be visible before asserting the derived status. Asserting
  // the chip first races that work and fails as "Tentative" intermittently.
  await expect(page.getByTestId('availability-attribution')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('status-chip')).toHaveText('Confirmed', { timeout: 15_000 })
  return page.url()
}

test('9.1.1 — a confirmed booking shows its components with computed counts', async ({ page }) => {
  await newlyConfirmed(page)

  await expect(page.getByTestId('snapshot-note')).toBeVisible()
  await expect(page.getByTestId('line-item')).not.toHaveCount(0)
  await expect(page.getByTestId('day-count')).not.toBeEmpty()
  await expect(page.getByTestId('visit-count')).not.toBeEmpty()
  await expect(page.getByTestId('pricing-total')).toContainText('$')
})

test('9.1.6 — RAISING THE BUSINESS DEFAULT DOES NOT CHANGE A CONFIRMED TOTAL', async ({ page }) => {
  const url = await newlyConfirmed(page)
  const before = await page.getByTestId('pricing-total').innerText()

  await page.goto('/settings')
  // Selected by the type attribute, not by text: the label lives in an input
  // VALUE, which contributes no text content for hasText to match.
  const daily = page.locator('[data-testid="default-component"][data-type="per_day"]')
  await expect(daily).toHaveCount(1)
  await daily.getByTestId('component-amount').fill('9.00')
  await daily.getByTestId('save-component').click()
  await expect(daily).toContainText('$9.00')

  await page.goto(url)
  await expect(page.getByTestId('pricing-total')).toHaveText(before)
})

test('9.1.2 — overriding the day count recalculates without changing the dates', async ({
  page,
}) => {
  await newlyConfirmed(page)
  const rangeBefore = await page.getByTestId('booking-range').innerText()
  const totalBefore = await page.getByTestId('pricing-total').innerText()

  await page.getByTestId('day-count-override').fill('2')
  await page.getByTestId('save-counts').click()

  await expect(page.getByTestId('day-count-overridden')).toBeVisible()
  await expect(page.getByTestId('day-count')).toHaveText('2')
  await expect(page.getByTestId('pricing-total')).not.toHaveText(totalBefore)
  // The dates are untouched.
  await expect(page.getByTestId('booking-range')).toHaveText(rangeBefore)
})

test('9.1.3 — a positive ad-hoc item raises the total', async ({ page }) => {
  await newlyConfirmed(page)
  const before = await page.getByTestId('pricing-total').innerText()

  await page.getByTestId('adhoc-label').fill('Cat litter')
  await page.getByTestId('adhoc-amount').fill('15.00')
  await page.getByTestId('save-adhoc').click()

  await expect(page.getByTestId('line-item').filter({ hasText: 'Cat litter' })).toHaveCount(1)
  const after = await page.getByTestId('pricing-total').innerText()
  expect(after).not.toBe(before)
})

test('9.1.4 — a negative ad-hoc item lowers the total', async ({ page }) => {
  await newlyConfirmed(page)

  await page.getByTestId('adhoc-label').fill('Returning customer discount')
  await page.getByTestId('adhoc-amount').fill('-10.00')
  await page.getByTestId('save-adhoc').click()

  const line = page.getByTestId('line-item').filter({ hasText: 'Returning customer discount' })
  await expect(line).toHaveCount(1)
  await expect(line.getByTestId('line-item-amount')).toHaveText('-$10.00')
})

test('9.1.5 — copy summary puts plain text on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await newlyConfirmed(page)

  const expected = await page.getByTestId('copy-summary').getAttribute('data-summary')
  await page.getByTestId('copy-summary').click()
  await expect(page.getByTestId('copy-confirmed')).toBeVisible()

  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toBe(expected)
  expect(clipboard).toContain('Total: $')
  expect(clipboard).not.toMatch(/<[a-z]/i)
})

test('9.1.7 — marking paid on a finished booking reads Closed', async ({ page }) => {
  const url = await confirmedBooking(page)

  // Move the booking into the past, then mark it paid.
  await page.getByTestId('detail-start-date').fill('2026-08-01')
  await page.getByTestId('detail-end-date').fill('2026-08-07')
  await page.getByTestId('save-dates').click()
  await expect(page.getByTestId('status-chip')).toHaveText('Complete')

  await page.goto(url)
  await page.getByTestId('paid-on').fill('2026-08-08')
  await page.getByTestId('paid-method').fill('Venmo')
  await page.getByTestId('mark-paid').click()

  await expect(page.getByTestId('status-chip')).toHaveText('Closed')
})

test('every displayed amount is formatted from integer cents', async ({ page }) => {
  await newlyConfirmed(page)
  const amounts = await page.getByTestId('line-item-amount').allTextContents()
  for (const amount of amounts) {
    // Exactly two decimal places, never a float artefact like $19.990000001.
    expect(amount).toMatch(/^-?\$\d+\.\d{2}$/)
  }
  await expect(page.getByTestId('pricing-total')).toHaveText(/^-?\$\d+\.\d{2}$/)
})

test('an amount that is not money is refused', async ({ page }) => {
  await newlyConfirmed(page)
  await page.getByTestId('adhoc-label').fill('Nonsense')
  await page.getByTestId('adhoc-amount').fill('twelve dollars')
  await page.getByTestId('save-adhoc').click()
  await expect(page.getByTestId('adhoc-error')).toBeVisible()
})
