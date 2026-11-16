/**
 * The two languages (lib/i18n): English at the bare path, French under /fr,
 * the language menu in the header, and the first-visit redirect from the
 * browser's language.
 */
import { expect, test } from './fixtures'

test('/fr is the French site: interface, html lang, hreflang', async ({ page }) => {
  await page.goto('/fr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByRole('heading', { name: 'À la une' })).toBeVisible()
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /localhost:3000$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/fr$/)
  // Every site link stays in French.
  const review = page.locator('main a[href*="/article/"]').first()
  await expect(review).toHaveAttribute('href', /^\/fr\/article\//)
})

test('French section pages: labels and day headings in French', async ({ page }) => {
  await page.goto('/fr/reviews')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tests')
  await expect(page.locator('main h2').first()).toHaveText(/^(Aujourd'hui|Hier|[A-Z][a-zé]+ \d{1,2} [a-zéû]+( \d{4})?)$/)
})

/** Open the language menu and pick an entry (retried: a click before hydration does nothing). */
async function pick(page: import('@playwright/test').Page, button: RegExp, entry: string) {
  const item = page.getByRole('menuitemradio', { name: entry })
  await expect(async () => {
    if (!(await item.isVisible())) await page.getByRole('button', { name: button }).click()
    await expect(item).toBeVisible({ timeout: 1000 })
  }).toPass()
  await item.click()
}

test('the language menu switches language and English date style', async ({ page }) => {
  await page.goto('/reviews')
  // The first card's date (the section headings are dates too).
  const dates = page.locator('main a time').first()
  await expect(dates).toHaveText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/) // 🇺🇸 Nov 5, 2026

  await pick(page, /^Language:/, 'English (UK dates)')
  await expect(page).toHaveURL(/\/reviews$/)
  await expect(dates).toHaveText(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/) // 🇬🇧 5 Nov 2026

  await pick(page, /^Language:/, 'Français')
  await expect(page).toHaveURL(/\/fr\/reviews$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tests')

  // The choice sticks: the English URL no longer sends a French reader away,
  // and an English choice is remembered too.
  await pick(page, /^Langue :/, 'English (US dates)')
  await expect(page).toHaveURL(/\/reviews$/)
  await page.goto('/news')
  await expect(page).toHaveURL(/\/news$/)
})

test('first visit: a French browser lands on /fr, unless it chose English', async ({ browser }) => {
  const context = await browser.newContext({
    locale: 'fr-FR',
    storageState: {
      cookies: [
        { name: '__client_uat', value: '0', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' },
        { name: '__clerk_db_jwt', value: 'e2e', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' },
      ],
      origins: [],
    },
  })
  const page = await context.newPage()
  await page.route(/clerk\.example\.com/, (route) => route.abort())
  await page.goto('/reviews')
  await expect(page).toHaveURL(/\/fr\/reviews$/)

  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', domain: 'localhost', path: '/' }])
  await page.goto('/reviews')
  await expect(page).toHaveURL(/\/reviews$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reviews')
  await context.close()
})

test('old French legal URLs and /en URLs redirect', async ({ page }) => {
  await page.goto('/fr/confidentialite')
  await expect(page).toHaveURL(/\/fr\/privacy$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Politique de confidentialité')
  await page.goto('/en/reviews')
  await expect(page).toHaveURL(/\/reviews$/)
})

test('an unknown French page is a French 404', async ({ page }) => {
  const res = await page.goto('/fr/article/this-does-not-exist')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
})
