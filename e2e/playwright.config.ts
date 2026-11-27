import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against a running Paul stack (the container image), by default
 * http://localhost:8080. Start it with:
 *
 *   podman-compose -f deploy/compose.yaml up --build -d
 *
 * or point PAUL_BASE_URL elsewhere.
 *
 * The `setup` project walks the first-run flow (sign in as admin with the default password and
 * choose a new one) and saves the signed-in state that the other projects start from. On a stack
 * where that has already happened it just signs in with the new password.
 */
export const ADMIN_STATE = '.auth/admin.json'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PAUL_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: ADMIN_STATE },
      dependencies: ['setup'],
    },
  ],
})
