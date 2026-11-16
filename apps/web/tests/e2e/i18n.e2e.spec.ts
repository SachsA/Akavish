/**
 * The two languages (lib/i18n): English at the bare path, French under /fr,
 * the language menu in the header, and the first-visit redirect from the
 * browser's language.
 */
import { CMS_URL, SEED_ADMIN, expect, test } from './fixtures'

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

test('an article: French on /fr once translated, English with a notice before', async ({ page, request }) => {
  // A throwaway article with a French version written in the CMS (the job
  // that translates with Claude doesn't run in the tests). Deleted at the end.
  test.setTimeout(90_000) // up to 30 s of CMS cache, see below
  const login = await request.post(`${CMS_URL}/api/users/login`, { data: SEED_ADMIN })
  const auth = { Authorization: `JWT ${(await login.json()).token}` }
  const author = (await (await request.get(`${CMS_URL}/api/authors?limit=1&depth=0`)).json()).docs[0]
  const run = Date.now().toString(36)
  const slug = `e2e-fr-${run}`
  const doc = (words: string) => ({
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
      children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
        children: [{ type: 'text', text: words, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] }],
    },
  })
  const created = await request.post(`${CMS_URL}/api/articles`, {
    headers: auth,
    data: {
      title: `E2E English title ${run}`, slug, excerpt: 'English excerpt.', content: doc('English body.'),
      category: 'news', status: 'published', _status: 'published', author: author.id,
    },
  })
  expect(created.ok()).toBeTruthy()
  const id = (await created.json()).doc.id
  try {
    await page.goto(`/fr/article/${slug}`)
    await expect(page.getByText("Cet article n'est pas encore traduit")).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/article/${slug}$`))

    const fr = await request.patch(`${CMS_URL}/api/articles/${id}`, {
      headers: auth,
      data: { fr: { title: `Titre français ${run}`, excerpt: 'Chapô.', content: doc('Corps en français.') } },
    })
    expect(fr.ok()).toBeTruthy()
    expect((await fr.json()).doc.fr.status).toBe('edited')

    // The page reads the CMS through a 30 s cache: wait for the new version.
    await expect(async () => {
      await page.goto(`/fr/article/${slug}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Titre français ${run}`, { timeout: 1000 })
    }).toPass({ timeout: 60_000 })
    await expect(page.getByText('Corps en français.')).toBeVisible()
    await expect(page.getByText("Traduit de l'anglais avec l'aide de l'IA")).toBeVisible()
    await page.goto(`/article/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`E2E English title ${run}`)
  } finally {
    await request.delete(`${CMS_URL}/api/articles/${id}`, { headers: auth })
  }
})
