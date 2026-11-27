import { expect, test } from '@playwright/test'
import { chooseNewPassword, expectLibrary, SIGNED_OUT, signIn, uniqueName } from './helpers'

test('a new user is added, signs in and must choose their own password', async ({
  page,
  browser,
}) => {
  const username = uniqueName('writer')

  await page.goto('/settings')
  await page.getByRole('main').getByRole('link', { name: /Users/ }).click()
  await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible()

  const form = page.getByRole('form', { name: 'Add user' })
  await form.getByLabel('Username').fill(username)
  await form.getByLabel('Temporary password').fill('temporary-pass')
  await form.getByRole('button', { name: 'Add user' }).click()
  await expect(form.getByRole('status')).toContainText(`Added ${username}`)

  const row = page.getByRole('listitem').filter({ hasText: username })
  await expect(row.getByText('Temporary password')).toBeVisible()

  // The new user signs in on their own device.
  const theirs = await browser.newContext({ storageState: SIGNED_OUT })
  const theirPage = await theirs.newPage()
  await signIn(theirPage, username, 'temporary-pass')
  await chooseNewPassword(theirPage, 'temporary-pass', 'their-own-password')
  await expectLibrary(theirPage)

  // The admin sees they've settled in.
  await page.reload()
  await expect(row).toBeVisible()
  await expect(row.getByText('Temporary password')).toHaveCount(0)

  // Resetting their password bounces them back to the change-password page.
  await row.getByRole('button', { name: 'Reset password' }).click()
  await row.getByLabel('New temporary password').fill('reset-temp-pass')
  await row.getByRole('button', { name: 'Set password' }).click()
  await expect(row.getByText('Temporary password')).toBeVisible()

  await theirPage.reload()
  await expect(theirPage.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await theirs.close()
})

test('duplicate usernames are refused', async ({ page }) => {
  await page.goto('/settings/users')
  const form = page.getByRole('form', { name: 'Add user' })
  await form.getByLabel('Username').fill('admin')
  await form.getByLabel('Temporary password').fill('temporary-pass')
  await form.getByRole('button', { name: 'Add user' }).click()

  await expect(form.getByText("Username 'admin' is already taken")).toBeVisible()
})
