/**
 * The public site, end to end, on the sample content from `pnpm seed`.
 * Titles and slugs below come from apps/cms/src/scripts/seed.ts.
 */
import { CMS_URL, SEED_ADMIN, expect, test } from './fixtures'

test('home: the featured article is the lead story', async ({ page }) => {
  await page.goto('/')
  const main = page.locator('main')
  // The seed features the Northlight recap even though it isn't the newest.
  await expect(main.getByRole('heading', { level: 2 }).first()).toHaveText(
    'Everything shown at the Northlight Showcase',
  )
  await expect(main.getByRole('heading', { name: 'Top stories' })).toBeVisible()
})

test('a category page lists its articles; past the last page is a 404', async ({ page }) => {
  await page.goto('/reviews')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reviews')
  await expect(page.getByRole('link', { name: /Neon Drift review/ }).first()).toBeVisible()
  // One page of results only: no pagination, and ?page=2 doesn't exist.
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toHaveCount(0)
  expect((await page.goto('/reviews?page=2'))?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  expect((await page.goto('/reviews?page=abc'))?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('article page: content, editor alt text, breadcrumbs, read next', async ({ page }) => {
  await page.goto('/article/neon-drift-review')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Neon Drift review: a gorgeous arcade racer that runs out of road',
  )
  // The hero uses the media's alt text from the CMS, not the title.
  await expect(page.locator('article img').first()).toHaveAttribute(
    'alt',
    /^Illustration for "Neon Drift review/,
  )
  const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(jsonLd).toContain('"BreadcrumbList"')
  expect(jsonLd).toContain('"NewsArticle"')
  await expect(page.getByRole('heading', { name: 'Read next' })).toBeVisible()
})

test('an unknown article is a real 404', async ({ page }) => {
  const res = await page.goto('/article/this-does-not-exist')
  expect(res?.status()).toBe(404) // no loading.tsx on article pages, so the status is right
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('search from the header finds an article', async ({ page, request }) => {
  await page.goto('/')
  const box = page.getByRole('searchbox', { name: 'Search articles' })
  await box.fill('neon')
  await box.press('Enter')
  await expect(page).toHaveURL(/\/search\?q=neon/)
  await expect(page.getByRole('link', { name: /Neon Drift/ }).first()).toBeVisible()

  const api = await (await request.get('/api/search?q=neon')).json()
  expect(api.engine).toBe('cms') // no Meilisearch in CI: the Postgres fallback answered
  expect(api.hits.length).toBeGreaterThan(0)
})

test('renaming a published article redirects the old URL (308)', async ({ request }) => {
  // A throwaway article with a never-visited slug, so no cached page can answer
  // for the old URL. Deleted at the end.
  const login = await request.post(`${CMS_URL}/api/users/login`, { data: SEED_ADMIN })
  expect(login.ok()).toBeTruthy()
  const auth = { Authorization: `JWT ${(await login.json()).token}` }
  const author = (await (await request.get(`${CMS_URL}/api/authors?limit=1&depth=0`)).json()).docs[0]

  const run = Date.now().toString(36)
  const oldSlug = `e2e-rename-${run}`
  const newSlug = `${oldSlug}-renamed`
  const text = { type: 'text', text: 'Body', format: 0, style: '', mode: 'normal', detail: 0, version: 1 }
  const paragraph = { type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', children: [text] }
  const created = await request.post(`${CMS_URL}/api/articles`, {
    headers: auth,
    data: {
      title: `E2E rename ${run}`,
      slug: oldSlug,
      excerpt: 'Created by the web e2e tests.',
      content: { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [paragraph] } },
      category: 'news',
      status: 'published',
      _status: 'published',
      author: author.id,
    },
  })
  expect(created.ok()).toBeTruthy()
  const id = (await created.json()).doc.id

  try {
    const renamed = await request.patch(`${CMS_URL}/api/articles/${id}`, { headers: auth, data: { slug: newSlug } })
    expect(renamed.ok()).toBeTruthy()

    const res = await request.get(`/article/${oldSlug}`, { maxRedirects: 0 })
    expect(res.status()).toBe(308) // a real permanent redirect, not a client-side hop
    expect(res.headers()['location']).toContain(`/article/${newSlug}`)
  } finally {
    await request.delete(`${CMS_URL}/api/articles/${id}`, { headers: auth })
  }
})

test('sitemap and RSS feed list the articles', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('/article/neon-drift-review')
  const feed = await (await request.get('/feed.xml')).text()
  expect(feed).toContain('<item>')
  expect(feed).toContain('Neon Drift')
})

test('the theme toggle switches to light and remembers it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible()
})
