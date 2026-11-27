import { expect, test } from '@playwright/test'
import { ADMIN_PASSWORD, expectLibrary, REMEMBER_ME_COOKIE, SIGNED_OUT, signIn } from './helpers'

test.describe('signed out', () => {
  test.use({ storageState: SIGNED_OUT })

  test('visitors are sent to sign in and returned afterwards', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/)

    await page.getByLabel('Username').fill('admin')
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('a wrong password is rejected', async ({ page }) => {
    await signIn(page, 'admin', 'definitely-not-it')
    await expect(page.getByRole('alert')).toHaveText('Incorrect username or password')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('the API refuses unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/users')
    expect(response.status()).toBe(401)
  })

  test('remembered devices stay signed in after the browser closes', async ({ browser, page }) => {
    await signIn(page, 'admin', ADMIN_PASSWORD)
    await expectLibrary(page)
    const cookies = await page.context().cookies()
    const rememberMe = cookies.find((c) => c.name === REMEMBER_ME_COOKIE)
    expect(rememberMe?.httpOnly).toBe(true)
    expect(rememberMe?.expires).toBeGreaterThan(Date.now() / 1000 + 80 * 24 * 3600)

    // "Reopen the browser": only persistent cookies survive, the session cookie is gone.
    const reopened = await browser.newContext({ storageState: SIGNED_OUT })
    await reopened.addCookies(cookies.filter((c) => c.expires > 0))
    const again = await reopened.newPage()
    await again.goto('/settings')

    await expect(again.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(again.getByRole('main').getByText('Signed in as')).toBeVisible()
    await reopened.close()
  })

  test('signing out on one device keeps the others signed in', async ({ browser }) => {
    const laptop = await browser.newContext({ storageState: SIGNED_OUT })
    const phone = await browser.newContext({ storageState: SIGNED_OUT })
    const laptopPage = await laptop.newPage()
    const phonePage = await phone.newPage()
    await signIn(laptopPage, 'admin', ADMIN_PASSWORD)
    await signIn(phonePage, 'admin', ADMIN_PASSWORD)
    await expectLibrary(laptopPage)
    await expectLibrary(phonePage)

    await phonePage.request.post('/api/auth/logout', {
      headers: {
        'X-XSRF-TOKEN': (await phone.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? '',
      },
    })

    // The laptop, even after "restarting" (session cookie dropped), is still remembered.
    const laptopCookies = (await laptop.cookies()).filter((c) => c.expires > 0)
    const restarted = await browser.newContext({ storageState: SIGNED_OUT })
    await restarted.addCookies(laptopCookies)
    const restartedPage = await restarted.newPage()
    await restartedPage.goto('/')
    await expectLibrary(restartedPage)

    await phonePage.goto('/')
    await expect(phonePage).toHaveURL(/\/login$/)
    await Promise.all([laptop.close(), phone.close(), restarted.close()])
  })

  test('signing out ends the session and forgets the device', async ({ page, isMobile }) => {
    await signIn(page, 'admin', ADMIN_PASSWORD)
    await expectLibrary(page)

    if (isMobile) {
      await page
        .getByRole('navigation', { name: 'Mobile' })
        .getByRole('link', { name: /Settings/ })
        .click()
      await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click()
    } else {
      await page
        .getByRole('complementary', { name: 'Primary' })
        .getByRole('button', { name: 'Sign out' })
        .click()
    }

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect((await page.context().cookies()).some((c) => c.name === REMEMBER_ME_COOKIE)).toBe(false)
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })
})
