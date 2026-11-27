import { expect, type Page } from '@playwright/test'

/** Password the setup project gives the first-run admin account. Test-only. */
export const ADMIN_PASSWORD = process.env.PAUL_E2E_ADMIN_PASSWORD ?? 'e2e-admin-password'
/** The server's out-of-the-box initial admin password (PAUL_ADMIN_PASSWORD default). */
export const INITIAL_ADMIN_PASSWORD = process.env.PAUL_INITIAL_ADMIN_PASSWORD ?? 'admin'

export const REMEMBER_ME_COOKIE = 'paul-remember-me'

/** A storage state with nothing in it: a brand-new browser. */
export const SIGNED_OUT = { cookies: [], origins: [] }

export function uniqueName(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export async function signIn(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

export async function chooseNewPassword(page: Page, current: string, next: string) {
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await page.getByLabel('Temporary password').fill(current)
  await page.getByLabel('New password', { exact: true }).fill(next)
  await page.getByLabel('Confirm new password').fill(next)
  await page.getByRole('button', { name: 'Save new password' }).click()
}

export async function expectLibrary(page: Page) {
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
}
