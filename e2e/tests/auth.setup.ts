import { expect, test as setup } from '@playwright/test'
import { ADMIN_STATE } from '../playwright.config'
import {
  ADMIN_PASSWORD,
  chooseNewPassword,
  expectLibrary,
  INITIAL_ADMIN_PASSWORD,
  signIn,
} from './helpers'

setup(
  'first run: admin signs in with the default password and must replace it',
  async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)

    await signIn(page, 'admin', INITIAL_ADMIN_PASSWORD)
    const firstRun = await page
      .getByRole('heading', { name: 'Choose a new password' })
      .waitFor({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (firstRun) {
      // Nothing else is reachable until the password is changed.
      await page.goto('/settings')
      await expect(page).toHaveURL(/\/change-password$/)
      await chooseNewPassword(page, INITIAL_ADMIN_PASSWORD, ADMIN_PASSWORD)
    } else {
      // This stack was already set up by an earlier run.
      await expect(page.getByRole('alert')).toHaveText('Incorrect username or password')
      await signIn(page, 'admin', ADMIN_PASSWORD)
    }

    await expectLibrary(page)
    await page.context().storageState({ path: ADMIN_STATE })
  },
)
