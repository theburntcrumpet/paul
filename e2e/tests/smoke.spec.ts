import { expect, test } from '@playwright/test'

test.describe('smoke', () => {
  test('health endpoint reports ok', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.ok()).toBeTruthy()
    expect(await response.json()).toMatchObject({ status: 'ok' })
  })

  test('app loads and shows the server as connected', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Paul')
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
    await expect(page.getByRole('status').filter({ visible: true })).toHaveText(/^v/)
  })

  test('navigation works and deep links survive a reload', async ({ page, isMobile }) => {
    await page.goto('/')
    const nav = isMobile
      ? page.getByRole('navigation', { name: 'Mobile' })
      : page.getByRole('complementary', { name: 'Primary' })
    await expect(nav).toBeVisible()

    await nav.getByRole('link', { name: /Settings/ }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('only the layout for the current viewport is visible', async ({ page, isMobile }) => {
    await page.goto('/')
    const mobileNav = page.getByRole('navigation', { name: 'Mobile' })
    const sidebar = page.getByRole('complementary', { name: 'Primary' })
    if (isMobile) {
      await expect(mobileNav).toBeVisible()
      await expect(sidebar).toBeHidden()
    } else {
      await expect(sidebar).toBeVisible()
      await expect(mobileNav).toBeHidden()
    }
  })

  test('unknown routes show the not-found page', async ({ page }) => {
    await page.goto('/no/such/page')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })
})
