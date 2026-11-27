import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against a running Paul stack (the container image), by default
 * http://localhost:8080. Start it with:
 *
 *   podman-compose -f deploy/compose.yaml up --build -d
 *
 * or point PAUL_BASE_URL elsewhere.
 */
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
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
