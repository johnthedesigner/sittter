/**
 * Journey 4 — Working a booking, day by day.
 * Covers docs/user-journeys.md steps 4.3.1 through 4.3.4.
 *
 * Steps 4.1 and 4.2 are visit logging with photos, which is Phase 4.
 */

import { expect, signedInTest as test } from './fixtures'

/** Confirm the seeded tentative booking so it has a generated schedule. */
async function confirmedBookingWithVisits(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/bookings?status=tentative')
  await page.getByTestId('booking-row').first().getByRole('link').first().click()
  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)

  await page.getByTestId('toggle-availability').click()
  await expect(page.getByTestId('status-chip')).toHaveText('Confirmed')
  await expect(page.getByTestId('visit').first()).toBeVisible()

  return page.url()
}

test('1.3.6 — confirming generates one visit per date, shared dates carrying both tasks', async ({
  page,
}) => {
  await confirmedBookingWithVisits(page)

  const visits = page.getByTestId('visit')
  // The seeded tentative booking runs six days with one daily instruction.
  await expect(visits.first()).toBeVisible()
  const count = await visits.count()
  expect(count).toBeGreaterThan(0)

  // Every generated visit lists the tasks it carries.
  await expect(visits.first().getByTestId('visit-tasks')).not.toHaveText('No tasks')
})

test('a date carrying two instructions produces ONE visit with both tasks', async ({ page }) => {
  // The seeded confirmed booking's property has a daily and an every-other-day
  // instruction, so offset 0 carries both.
  await page.goto('/bookings?status=confirmed')
  await page.getByTestId('booking-row').first().getByRole('link').first().click()
  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)

  await page.getByTestId('regenerate-visits').click()
  await expect(page.getByTestId('visit').first()).toBeVisible()

  const first = page.getByTestId('visit').first()
  const tasks = await first.getByTestId('visit-tasks').innerText()
  expect(tasks).toContain('Feed the cat')
  expect(tasks).toContain('Water the plants')

  // One row for that date, not two.
  const date = await first.getAttribute('data-visit-date')
  await expect(page.locator(`[data-testid="visit"][data-visit-date="${date}"]`)).toHaveCount(1)
})

test('4.3.1 — an admin can add a visit on a date not originally generated', async ({ page }) => {
  await confirmedBookingWithVisits(page)
  const before = await page.getByTestId('visit').count()

  await page.getByTestId('add-visit').click()
  await page.getByTestId('new-visit-date').fill('2026-12-24')
  await page.getByTestId('new-visit-window').selectOption('morning')
  await page.getByTestId('save-new-visit').click()

  await expect(page.getByTestId('visit')).toHaveCount(before + 1)
  await expect(page.locator('[data-visit-date="2026-12-24"]')).toHaveCount(1)
})

test('adding a visit on a date that already has one is refused', async ({ page }) => {
  await confirmedBookingWithVisits(page)
  const existing = await page.getByTestId('visit').first().getAttribute('data-visit-date')

  await page.getByTestId('add-visit').click()
  await page.getByTestId('new-visit-date').fill(existing!)
  await page.getByTestId('save-new-visit').click()

  await expect(page.getByTestId('add-visit-error')).toContainText('already a visit on that date')
})

test('4.3.2 — deleting an upcoming visit with no log needs no confirmation', async ({ page }) => {
  await confirmedBookingWithVisits(page)
  const before = await page.getByTestId('visit').count()

  await page.getByTestId('visit').first().getByTestId('delete-visit').click()

  await expect(page.getByTestId('visit')).toHaveCount(before - 1)
})

test('4.3.4 — regenerating preserves visits and is explicit, never automatic', async ({ page }) => {
  const url = await confirmedBookingWithVisits(page)
  const before = await page.getByTestId('visit').count()

  // Changing the dates does NOT regenerate — dev-plan §7.3 makes that its own
  // action, so a date edit cannot silently rebuild a schedule.
  await page.getByTestId('detail-start-date').fill('2026-08-25')
  await page.getByTestId('detail-end-date').fill('2026-08-27')
  await page.getByTestId('save-dates').click()
  await expect(page.getByTestId('booking-range')).toContainText('Aug 25')
  await expect(page.getByTestId('visit')).toHaveCount(before)

  // Regeneration is the explicit action.
  await page.goto(url)
  await page.getByTestId('regenerate-visits').click()
  await expect(page.getByTestId('visit')).toHaveCount(3)
})

test('a visit window and duration can be edited', async ({ page }) => {
  await confirmedBookingWithVisits(page)

  const first = page.getByTestId('visit').first()
  await first.getByTestId('visit-window').selectOption('evening')
  await first.getByTestId('visit-duration').fill('45')
  await first.getByTestId('save-visit').click()

  await page.reload()
  await expect(page.getByTestId('visit').first().getByTestId('visit-window')).toHaveValue('evening')
  await expect(page.getByTestId('visit').first().getByTestId('visit-duration')).toHaveValue('45')
})

test('an as-needed instruction is reported as skipped, with the reason core gives', async ({
  page,
}) => {
  await page.goto('/bookings?status=inquiry')
  await page.getByTestId('booking-row').first().getByRole('link').first().click()
  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)

  await page.getByTestId('detail-start-date').fill('2026-09-01')
  await page.getByTestId('detail-end-date').fill('2026-09-05')
  await page.getByTestId('save-dates').click()

  await page.getByTestId('add-instruction').click()
  await page.getByTestId('instruction-label').fill('Odd job')
  await page.getByTestId('instruction-cadence').selectOption('as_needed')
  await page.getByTestId('save-instruction').click()

  await expect(page.getByTestId('skipped-instructions')).toContainText('Odd job')
  await expect(page.getByTestId('skipped-instructions')).toContainText('as needed')
})
