#!/usr/bin/env node
/**
 * Publish (or schedule) articles written in Markdown to a running CMS over
 * its REST API, with their cover images and games. No dependencies: plain
 * Node ≥ 20 (fetch, FormData, fs.openAsBlob).
 *
 *   node apps/cms/scripts/publish-articles.mjs <articles.md> [--images <dir>] [--only <slug,slug>] [--dry]
 *
 * Login: CMS_EMAIL / CMS_PASSWORD from the environment or from `.cms-import`
 * at the repo root (gitignored, never printed). CMS_URL defaults to
 * https://cms.akavish.gg. Use a dedicated editor account.
 *
 * The file is a series of blocks, each a front matter between `---` lines,
 * then (for articles) the body in Markdown:
 *
 *   ---
 *   type: game                      # creates the game if its slug is new
 *   slug: grand-theft-auto-vi
 *   name: Grand Theft Auto VI
 *   developer: Rockstar Games
 *   platform: PlayStation, Xbox
 *   genre: Action
 *   releaseDate: 2026-11-19
 *   cover: gta-key-art.jpg          # file in --images
 *   coverAlt: Grand Theft Auto VI official key art
 *   ---
 *   ---
 *   type: article                   # created, or updated if the slug exists
 *   slug: gta-vi-everything-we-know
 *   title: GTA VI: everything we know
 *   category: news                  # news | leak | review | preview | conference | esport
 *   game: grand-theft-auto-vi       # optional, a game slug
 *   excerpt: …
 *   seo: …                          # SEO description
 *   cover: gta-vice-city.jpg
 *   coverAlt: …
 *   aiAssisted: true
 *   publishAt: now                  # now | an ISO date (scheduled) | draft
 *   ---
 *   Body: paragraphs, ## / ### headings (both become h2), "- " lists,
 *   **bold** and [links](https://…).
 *
 * Re-running is safe: games and media are reused by slug / alt text, and
 * articles are updated in place (a published one stays published). A
 * scheduled article gets its publish queued again on each run (harmless, it
 * publishes once), so to fix one piece pass --only <its slug>.
 */
import { existsSync, openAsBlob, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// ─── Markdown → blocks and Lexical (exported for the unit test) ──────────────

export function parseFile(source) {
  // `---` lines alternate front matter and body; bodies don't use `---`.
  const parts = source
    .replace(/\r\n/g, '\n')
    .split(/^---[ \t]*$/m)
    .slice(1)
  const blocks = []
  for (let i = 0; i < parts.length; i += 2) {
    const meta = {}
    for (const line of (parts[i] ?? '').split('\n')) {
      const at = line.indexOf(':')
      if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim()
    }
    if (meta.type) blocks.push({ meta, body: (parts[i + 1] ?? '').trim() })
  }
  return blocks
}

const text = (t, format = 0) => ({
  type: 'text',
  text: t,
  format,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})
const element = (type, children, extra = {}) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})

/** Inline Markdown: **bold** and [label](url). */
export function inline(s) {
  const out = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let last = 0
  for (const m of s.matchAll(re)) {
    if (m.index > last) out.push(text(s.slice(last, m.index)))
    if (m[1]) out.push(text(m[1], 1))
    else
      out.push(
        element('link', inline(m[2]), {
          version: 3,
          fields: { linkType: 'custom', url: m[3], newTab: true },
        }),
      )
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(text(s.slice(last)))
  return out
}

export function toLexical(markdown) {
  const children = []
  for (const chunk of markdown.split(/\n{2,}/)) {
    const lines = chunk.split('\n').filter((l) => l.trim())
    if (!lines.length) continue
    const heading = lines[0].match(/^#{2,4}\s+(.*)$/)
    if (heading && lines.length === 1) {
      children.push(element('heading', inline(heading[1]), { tag: 'h2' }))
    } else if (lines.every((l) => /^[-*]\s+/.test(l))) {
      children.push(
        element(
          'list',
          lines.map((l, i) =>
            element('listitem', inline(l.replace(/^[-*]\s+/, '')), { value: i + 1 }),
          ),
          { listType: 'bullet', start: 1, tag: 'ul' },
        ),
      )
    } else {
      children.push(element('paragraph', inline(lines.join(' ')), { textFormat: 0 }))
    }
  }
  return { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children } }
}

// ─── CMS ─────────────────────────────────────────────────────────────────────

function credentials() {
  const env = { ...process.env }
  const path = join(ROOT, '.cms-import')
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  if (!env.CMS_EMAIL || !env.CMS_PASSWORD) {
    throw new Error('CMS_EMAIL / CMS_PASSWORD missing (environment or .cms-import).')
  }
  return {
    email: env.CMS_EMAIL,
    password: env.CMS_PASSWORD,
    url: env.CMS_URL || 'https://cms.akavish.gg',
  }
}

async function main() {
  const args = process.argv.slice(2)
  const file = args.find(
    (a, i) => !a.startsWith('--') && args[i - 1] !== '--images' && args[i - 1] !== '--only',
  )
  const imagesDir = args.includes('--images') ? args[args.indexOf('--images') + 1] : null
  const dry = args.includes('--dry')
  // --only a,b: touch just these articles (an edit to one piece doesn't
  // re-queue the scheduled publishes of all the others).
  const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null
  if (!file) {
    throw new Error(
      'Usage: publish-articles.mjs <articles.md> [--images <dir>] [--only <slug,slug>] [--dry]',
    )
  }
  const blocks = parseFile(readFileSync(file, 'utf8'))
  const { email, password, url } = credentials()
  const api = `${url.replace(/\/+$/, '')}/api`

  const login = await fetch(`${api}/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!login.ok) throw new Error(`Login failed (${login.status}).`)
  const { token } = await login.json()
  const auth = { Authorization: `JWT ${token}` }

  const call = async (path, init = {}) => {
    const res = await fetch(`${api}${path}`, {
      ...init,
      headers: {
        ...auth,
        ...(init.body && !(init.body instanceof FormData)
          ? { 'content-type': 'application/json' }
          : {}),
        ...init.headers,
      },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok)
      throw new Error(
        `${init.method ?? 'GET'} ${path}: ${res.status} ${JSON.stringify(body).slice(0, 300)}`,
      )
    return body
  }
  const findOne = async (collection, field, value) =>
    (
      await call(
        `/${collection}?where[${field}][equals]=${encodeURIComponent(value)}&limit=1&depth=0&draft=true`,
      )
    ).docs?.[0]

  async function media(name, alt) {
    if (!name) return undefined
    const existing = await findOne('media', 'alt', alt)
    if (existing) return existing.id
    if (!imagesDir) throw new Error(`--images is required for ${name}`)
    const path = join(imagesDir, name)
    if (dry) return `(upload ${basename(path)})`
    const form = new FormData()
    form.append('file', await openAsBlob(path), basename(path))
    form.append('_payload', JSON.stringify({ alt }))
    const res = await call('/media', { method: 'POST', body: form })
    return res.doc.id
  }

  const author = await findOne('authors', 'slug', 'akavish')
  if (!author) throw new Error('Author "akavish" not found.')
  const games = {}

  for (const { meta, body } of blocks) {
    if (meta.type === 'game') {
      const found = await findOne('games', 'slug', meta.slug)
      if (found) {
        games[meta.slug] = found.id
        console.log(`game   ${meta.slug}: exists (${found.id})`)
        continue
      }
      const data = {
        name: meta.name,
        slug: meta.slug,
        developer: meta.developer,
        platform: meta.platform?.split(',').map((p) => p.trim()),
        genre: meta.genre?.split(',').map((g) => g.trim()),
        releaseDate: meta.releaseDate,
        cover: await media(meta.cover, meta.coverAlt),
      }
      if (dry) {
        console.log(`game   ${meta.slug}: would create`)
        continue
      }
      const res = await call('/games', { method: 'POST', body: JSON.stringify(data) })
      games[meta.slug] = res.doc.id
      console.log(`game   ${meta.slug}: created (${res.doc.id})`)
      continue
    }

    if (meta.type !== 'article' || (only && !only.has(meta.slug))) continue
    const data = {
      title: meta.title,
      slug: meta.slug,
      excerpt: meta.excerpt,
      content: toLexical(body),
      category: meta.category,
      author: author.id,
      game: meta.game
        ? (games[meta.game] ?? (await findOne('games', 'slug', meta.game))?.id)
        : undefined,
      coverImage: await media(meta.cover, meta.coverAlt),
      aiAssisted: meta.aiAssisted === 'true',
      seo: { title: meta.title, description: meta.seo },
    }
    const existing = await findOne('articles', 'slug', meta.slug)
    const live = existing?.status === 'published'
    const now = meta.publishAt === 'now'
    const schedule = !now && meta.publishAt && meta.publishAt !== 'draft' ? meta.publishAt : null
    const state =
      live || now
        ? { _status: 'published', status: 'published' }
        : { _status: 'draft', status: 'draft' }

    if (dry) {
      console.log(
        `article ${meta.slug}: would ${existing ? 'update' : 'create'} (${live || now ? 'published' : schedule ? `scheduled ${schedule}` : 'draft'})`,
      )
      continue
    }
    const res = existing
      ? await call(`/articles/${existing.id}${state._status === 'draft' ? '?draft=true' : ''}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...data, ...state }),
        })
      : await call(`/articles${state._status === 'draft' ? '?draft=true' : ''}`, {
          method: 'POST',
          body: JSON.stringify({ ...data, ...state }),
        })
    const id = res.doc.id
    if (schedule && !live) {
      await call('/articles-schedule', {
        method: 'POST',
        body: JSON.stringify({ id, publishAt: schedule }),
      })
    }
    console.log(
      `article ${meta.slug}: ${existing ? 'updated' : 'created'} (${id}), ${live || now ? 'published' : schedule ? `scheduled for ${schedule}` : 'draft'}`,
    )
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
