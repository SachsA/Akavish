import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests of the public site, against a running web app (:3000) that
 * reads a running CMS (:3001) filled by `pnpm seed`.
 *
 * Locally: `docker compose up -d`, `pnpm migrate` + `pnpm seed` + `pnpm dev` in
 * apps/cms, then `pnpm test:e2e` here (it starts `pnpm dev` on :3000 if nothing
 * is running). In CI the workflow starts the production builds first.
 */
export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // one test renames an article in the CMS; keep runs sequential
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Clerk's development keys redirect a cookie-less browser to Clerk for a
    // "dev browser" handshake, which CI's placeholder key can't complete. These
    // two cookies make Clerk treat the visitor as signed out without it.
    storageState: {
      cookies: [
        { name: '__client_uat', value: '0', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' },
        { name: '__clerk_db_jwt', value: 'e2e', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' },
      ],
      origins: [],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chromium' } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
