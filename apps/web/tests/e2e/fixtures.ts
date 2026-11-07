import { test as base, expect } from '@playwright/test'

/** Every test: no requests to Clerk's servers (CI uses a placeholder key). */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(/clerk\.(example\.com|accounts\.dev)|\.clerk\.accounts/, (route) => route.abort())
    await provide(page)
  },
})

export { expect }

export const CMS_URL = process.env.CMS_URL ?? 'http://localhost:3001'
export const SEED_ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || 'admin@akavish.test',
  password: process.env.SEED_ADMIN_PASSWORD || 'akavish-local',
}
