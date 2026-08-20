/**
 * Journey 1 — A neighbor asks in person, and the booking becomes confirmed.
 * Covers docs/user-journeys.md steps 1.1.1 and 1.3.2 so far.
 *
 * Later steps arrive with the tasks that build them: 1.3.1–1.3.5 in Task 2.4,
 * 1.3.6 in Task 2.5.
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

// ── Fast capture, steps 1.1.2 through 1.1.7 ──────────────────────────

test('1.1.2 — the capture form opens with the customer field focused', async ({ page }) => {
  await page.goto('/home')
  await page.getByTestId('new-booking').click()

  await expect(page).toHaveURL(/\/bookings\/new$/)
  await expect(page.getByTestId('customer-input')).toBeFocused()
})

test('1.1.3 — typing an unmatched name offers to create that customer', async ({ page }) => {
  await page.goto('/bookings/new')
  await page.getByTestId('customer-input').fill('Marguerite Okonjo')

  const create = page.getByTestId('create-customer-option')
  await expect(create).toBeVisible()
  await expect(create).toContainText('Marguerite Okonjo')
})

test('1.1.3 — typing a matching name offers the existing customer, not a create', async ({
  page,
}) => {
  await page.goto('/bookings/new')
  await page.getByTestId('customer-input').fill('Dana')

  await expect(page.getByTestId('customer-option').first()).toContainText('Dana Whitfield')
})

test('1.1.4 — choosing create shows the name and defaults to a new property', async ({ page }) => {
  await page.goto('/bookings/new')
  await page.getByTestId('customer-input').fill('Marguerite Okonjo')
  await page.getByTestId('create-customer-option').click()

  await expect(page.getByTestId('chosen-customer')).toHaveText('Marguerite Okonjo')
  await expect(page.getByTestId('property-select')).toHaveValue('')
})

test('a customer with exactly one property has it selected already', async ({ page }) => {
  // Seeded: Dana Whitfield has one property, Maple Street.
  await page.goto('/bookings/new')
  await page.getByTestId('customer-input').fill('Dana')
  await page.getByTestId('customer-option').first().click()

  const select = page.getByTestId('property-select')
  await expect(select).not.toHaveValue('')
  await expect(select.locator('option:checked')).toHaveText('Maple Street')
})

test('1.1.5 — entering both dates turns "Dates are approximate" on', async ({ page }) => {
  await page.goto('/bookings/new')
  await expect(page.getByTestId('dates-approximate')).not.toBeChecked()

  await page.getByTestId('start-date').fill('2026-09-01')
  await page.getByTestId('end-date').fill('2026-09-07')

  await expect(page.getByTestId('dates-approximate')).toBeChecked()
})

test('1.1.6, 1.1.7 — capture saves and the detail screen shows Tentative and the note', async ({
  page,
}) => {
  await page.goto('/bookings/new')
  await page.getByTestId('customer-input').fill('Marguerite Okonjo')
  await page.getByTestId('create-customer-option').click()
  await page.getByTestId('start-date').fill('2026-09-01')
  await page.getByTestId('end-date').fill('2026-09-07')
  await page.getByTestId('note').fill('Two cats, wants photos.')
  await page.getByTestId('save-booking').click()

  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)

  await expect(page.getByTestId('booking-customer')).toHaveText('Marguerite Okonjo')
  await expect(page.getByTestId('status-chip')).toHaveText('Tentative')

  const entries = page.getByTestId('activity-entry')
  await expect(entries).toHaveCount(2)
  await expect(entries.filter({ hasText: 'Two cats, wants photos.' })).toHaveCount(1)
  await expect(entries.filter({ hasText: 'created this booking' })).toHaveCount(1)
})

test('saving with only a customer name produces an Inquiry', async ({ page }) => {
  await page.goto('/bookings/new')
  await page.getByTestId('customer-input').fill('Solo Name')
  await page.getByTestId('create-customer-option').click()
  await page.getByTestId('save-booking').click()

  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)
  await expect(page.getByTestId('status-chip')).toHaveText('Inquiry')
})

test('an end date before the start date is rejected with a message', async ({ page }) => {
  await page.goto('/bookings/new')
  await page.getByTestId('customer-input').fill('Backwards Dates')
  await page.getByTestId('create-customer-option').click()
  await page.getByTestId('start-date').fill('2026-09-07')
  await page.getByTestId('end-date').fill('2026-09-01')
  await page.getByTestId('save-booking').click()

  await expect(page.getByTestId('capture-error')).toHaveText(
    'The end date cannot be before the start date.'
  )
  // Still on the form, nothing written.
  await expect(page).toHaveURL(/\/bookings\/new$/)
})

test('the capture form fits one-handed on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/bookings/new')
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflows).toBe(false)
})

// ── Filling in the details later, steps 1.2.1 through 1.2.5 ──────────

/** Open the seeded inquiry booking, which has no care instructions. */
async function openSeededInquiry(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/bookings?status=inquiry')
  await page.getByTestId('booking-row').first().getByRole('link').first().click()
  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)
}

test('1.2.1 — opening a booking from the list shows its detail screen', async ({ page }) => {
  await page.goto('/bookings')
  await page.getByTestId('booking-row').first().getByRole('link').first().click()

  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)
  await expect(page.getByTestId('booking-customer')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Care instructions' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dates' })).toBeVisible()
})

test('1.2.2 — an instruction added from a booking attaches to the property', async ({ page }) => {
  await openSeededInquiry(page)

  await page.getByTestId('add-instruction').click()
  await page.getByTestId('instruction-label').fill('Cats')
  await page.getByTestId('instruction-detail').fill('Half a tin, morning only.')
  await page.getByTestId('instruction-cadence').selectOption('every_day')
  await page.getByTestId('save-instruction').click()

  const added = page.getByTestId('instruction').filter({ hasText: 'Cats' })
  await expect(added).toHaveCount(1)
  // Attached to the property, so it is not marked as a booking-only override.
  await expect(added).toHaveAttribute('data-override', 'false')
  await expect(added).toContainText('Every day')
})

test('1.2.3 — an instruction can be weather relevant with a different cadence', async ({
  page,
}) => {
  await openSeededInquiry(page)

  await page.getByTestId('add-instruction').click()
  await page.getByTestId('instruction-label').fill('Plants')
  await page.getByTestId('instruction-cadence').selectOption('every_other_day')
  await page.getByTestId('instruction-weather').check()
  await page.getByTestId('save-instruction').click()

  const added = page.getByTestId('instruction').filter({ hasText: 'Plants' })
  await expect(added).toHaveCount(1)
  await expect(added).toContainText('Every other day')
  await expect(added).toContainText('weather relevant')
})

test('"This booking only" makes an override that shadows the property instruction', async ({
  page,
}) => {
  // The seeded confirmed booking's property already has "Feed the cat".
  await page.goto('/bookings?status=confirmed')
  await page.getByTestId('booking-row').first().getByRole('link').first().click()
  await page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/)

  const before = await page.getByTestId('instruction').count()

  await page.getByTestId('add-instruction').click()
  await page.getByTestId('instruction-label').fill('Feed the cat')
  await page.getByTestId('instruction-detail').fill('Twice a day this time')
  await page.getByTestId('instruction-cadence').selectOption('every_day')
  await page.getByTestId('instruction-booking-only').check()
  await page.getByTestId('save-instruction').click()

  // Shadowed, not added alongside: the count is unchanged.
  await expect(page.getByTestId('instruction')).toHaveCount(before)

  const overridden = page.getByTestId('instruction').filter({ hasText: 'Feed the cat' })
  await expect(overridden).toHaveAttribute('data-override', 'true')
  await expect(overridden).toContainText('Twice a day this time')
  await expect(overridden.getByTestId('override-badge')).toBeVisible()
})

test('a custom cadence stores its free text', async ({ page }) => {
  await openSeededInquiry(page)

  await page.getByTestId('add-instruction').click()
  await page.getByTestId('instruction-label').fill('Odd job')
  await page.getByTestId('instruction-cadence').selectOption('custom')
  await page.getByTestId('instruction-cadence-custom').fill('Whenever it rains')
  await page.getByTestId('save-instruction').click()

  const added = page.getByTestId('instruction').filter({ hasText: 'Odd job' })
  await expect(added).toContainText('Custom')
  await expect(added).toContainText('Whenever it rains')
})

test('every cadence label matches the reference data', async ({ page }) => {
  await openSeededInquiry(page)
  await page.getByTestId('add-instruction').click()

  const options = await page.getByTestId('instruction-cadence').locator('option').allTextContents()
  expect(options).toEqual([
    'Every day',
    'Every other day',
    'Every third day',
    'Once at the start',
    'Once at the end',
    'As needed',
    'Custom',
  ])
})

test('1.2.4 — the property address is editable from the booking', async ({ page }) => {
  await openSeededInquiry(page)

  await page.getByTestId('property-address').fill('14 Maple Street')
  await page.getByTestId('save-property').click()

  await page.reload()
  await expect(page.getByTestId('property-address')).toHaveValue('14 Maple Street')
})

test('1.2.5 — the access code field is visibly labelled admin only', async ({ page }) => {
  await openSeededInquiry(page)

  const adminOnly = page.getByTestId('admin-only-fields')
  await expect(adminOnly).toBeVisible()
  await expect(adminOnly).toContainText('Admin only')
  await expect(adminOnly).toContainText('never shown to the customer')
  // The access code input is inside that labelled region, not merely near it.
  await expect(adminOnly.getByTestId('property-access-codes')).toBeVisible()
})

test('1.2.5 — a garage code saves and reads back', async ({ page }) => {
  await openSeededInquiry(page)
  await page.getByTestId('property-access-codes').fill('4417')
  await page.getByTestId('save-property').click()
  await page.reload()
  await expect(page.getByTestId('property-access-codes')).toHaveValue('4417')
})

test('changing the dates writes a system activity entry', async ({ page }) => {
  await openSeededInquiry(page)

  await page.getByTestId('detail-start-date').fill('2026-09-01')
  await page.getByTestId('detail-end-date').fill('2026-09-07')
  await page.getByTestId('save-dates').click()

  await expect(page.getByTestId('booking-range')).toContainText('Sep 1')
  const system = page.getByTestId('activity-entry').filter({ hasText: 'changed the dates' })
  await expect(system).toHaveCount(1)
  await expect(system).toHaveAttribute('data-system', 'true')
})

test('an inverted range is rejected with a message, not a database error', async ({ page }) => {
  await openSeededInquiry(page)

  await page.getByTestId('detail-start-date').fill('2026-09-07')
  await page.getByTestId('detail-end-date').fill('2026-09-01')
  await page.getByTestId('save-dates').click()

  await expect(page.getByTestId('dates-error')).toHaveText(
    'The end date cannot be before the start date.'
  )
})

test('an instruction can be deleted', async ({ page }) => {
  await openSeededInquiry(page)
  await page.getByTestId('add-instruction').click()
  await page.getByTestId('instruction-label').fill('Temporary')
  await page.getByTestId('save-instruction').click()
  await expect(page.getByTestId('instruction').filter({ hasText: 'Temporary' })).toHaveCount(1)

  await page
    .getByTestId('instruction')
    .filter({ hasText: 'Temporary' })
    .getByTestId('delete-instruction')
    .click()
  await expect(page.getByTestId('instruction').filter({ hasText: 'Temporary' })).toHaveCount(0)
})
