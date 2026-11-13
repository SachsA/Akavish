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
  const box = page.getByRole('combobox', { name: 'Search articles' })
  await box.fill('neon')
  await box.press('Enter')
  await expect(page).toHaveURL(/\/search\?q=neon/)
  await expect(page.getByRole('link', { name: /Neon Drift/ }).first()).toBeVisible()

  const api = await (await request.get('/api/search?q=neon')).json()
  expect(api.engine).toBe('cms') // no Meilisearch in CI: the Postgres fallback answered
  expect(api.hits.length).toBeGreaterThan(0)
})

test('the header suggests games and articles as you type', async ({ page }) => {
  await page.goto('/')
  const box = page.getByRole('combobox', { name: 'Search articles' })
  await box.click()
  await box.pressSequentially('hollow', { delay: 30 })
  const list = page.getByRole('listbox', { name: 'Suggestions' })
  await expect(list.getByRole('option', { name: /Game\s*Hollow Crown/ })).toBeVisible()
  await expect(list.getByRole('option', { name: /ratings board/ })).toBeVisible()
  await expect(list.getByRole('option', { name: 'See all results for “hollow”' })).toBeVisible()
  // Arrow down to the first suggestion (the game) and open it.
  await box.press('ArrowDown')
  await box.press('Enter')
  await expect(page).toHaveURL(/\/game\/hollow-crown$/)
})

test('search page: section chips with counts, game filter, highlighting', async ({ page, request }) => {
  await page.goto('/search?q=neon')
  const chips = page.getByRole('navigation', { name: 'Filter by section' })
  await expect(chips.getByRole('link', { name: /^All\s*2$/ })).toBeVisible()
  await expect(chips.getByRole('link', { name: /^Reviews\s*1$/ })).toBeVisible()
  // Sections without a match are hidden once the counts are in.
  await expect(chips.getByRole('link', { name: /^Esport/ })).toHaveCount(0)
  await expect(page.locator('main mark').first()).toHaveText(/neon/i)

  await chips.getByRole('link', { name: /^Reviews/ }).click()
  await expect(page).toHaveURL(/\/search\?q=neon&category=review/)
  await expect(page.locator('main li h2')).toHaveCount(1)

  // A game name matches too, and the game filter keeps only its articles.
  const byGame = await (await request.get('/api/search?q=drift&game=neon-drift&facets=1')).json()
  expect(byGame.gameName).toBe('Neon Drift')
  expect(byGame.hits.every((h: { gameSlug?: string }) => h.gameSlug === 'neon-drift')).toBe(true)
  expect(byGame.facets.review).toBe(1)
})

test('Save on an article is for signed-in readers', async ({ page, request }) => {
  await page.goto('/article/neon-drift-review')
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  // The API never takes the reader from the request: signed out, nothing.
  expect((await request.get('/api/bookmarks?article=1')).status()).toBe(401)
  expect((await request.post('/api/bookmarks', { data: { articleId: '1' } })).status()).toBe(401)
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

/**
 * Each newsletter test posts from its own fake client IP: the sign-up route
 * allows 5 requests a minute per IP, and desktop + mobile + CI retries (or two
 * local runs back to back) would otherwise hit it. Vercel overwrites
 * `x-real-ip` in production, so this only works against a local server.
 */
async function freshIp(page: import('@playwright/test').Page) {
  await page.setExtraHTTPHeaders({ 'x-real-ip': `e2e-${Date.now()}-${Math.random()}` })
}

test('newsletter: signing up from the footer creates a pending subscriber', async ({ page, request }) => {
  await freshIp(page)
  const email = `e2e-${Date.now().toString(36)}@example.com`
  await page.goto('/about')
  const form = page.locator('footer')
  await form.getByLabel('Email address').fill(email)
  await form.getByLabel(/I agree to receive the Akavish newsletter/).check()
  await form.getByRole('button', { name: 'Subscribe' }).click()
  await expect(form.getByRole('status')).toContainText('Check your inbox')

  // Pending until the emailed link is clicked (double opt-in).
  const login = await request.post(`${CMS_URL}/api/users/login`, { data: SEED_ADMIN })
  const auth = { Authorization: `JWT ${(await login.json()).token}` }
  const list = await request.get(
    `${CMS_URL}/api/subscribers?where[email][equals]=${encodeURIComponent(email)}`,
    { headers: auth }
  )
  const sub = (await list.json()).docs[0]
  try {
    expect(sub).toMatchObject({ email, status: 'pending', source: 'footer' })
    expect(sub.tokenHash).toBeUndefined() // hidden field, never in the API
  } finally {
    if (sub) await request.delete(`${CMS_URL}/api/subscribers/${sub.id}`, { headers: auth })
  }
})

test('newsletter: no consent, no sign-up', async ({ page }) => {
  await freshIp(page)
  await page.goto('/about')
  const form = page.locator('footer')
  await form.getByLabel('Email address').fill('e2e-noconsent@example.com')
  await form.getByRole('button', { name: 'Subscribe' }).click()
  await expect(form.getByRole('alert')).toContainText('Tick the box')
})

test('newsletter: dead confirm and unsubscribe links say so', async ({ page }) => {
  await page.goto('/newsletter/confirm?token=not-a-real-token-at-all-0000')
  await expect(page.getByRole('heading', { name: 'This link no longer works' })).toBeVisible()

  await page.goto('/newsletter/unsubscribe?token=1.forged')
  await page.getByRole('button', { name: 'Unsubscribe' }).click()
  await expect(page.getByRole('heading', { name: 'Already unsubscribed' })).toBeVisible()
  expect(page.url()).not.toContain('token=') // the result page doesn't carry the token
})
