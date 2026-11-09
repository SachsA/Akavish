import { test as base, expect } from '@playwright/test'

/**
 * Every test: no requests to Clerk's servers (CI uses a placeholder key).
 *
 * Clerk's script gets an empty 200 rather than a network error. On an error,
 * Clerk's loader removes its <script> from <head>, and when that landed while
 * React was still hydrating (1 page load in ~30 here), hydration failed
 * (React #418) and React re-rendered the whole document, wiping `data-theme`:
 * that was the "flaky" theme test. Other Clerk calls are still aborted.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(/clerk\.(example\.com|accounts\.dev)|\.clerk\.accounts/, (route) =>
      route.request().resourceType() === 'script'
        ? route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
        : route.abort()
    )
    await provide(page)
  },
})

export { expect }

export const CMS_URL = process.env.CMS_URL ?? 'http://localhost:3001'
export const SEED_ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || 'admin@akavish.test',
  password: process.env.SEED_ADMIN_PASSWORD || 'akavish-local',
}
