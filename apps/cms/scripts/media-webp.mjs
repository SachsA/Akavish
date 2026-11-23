#!/usr/bin/env node
/**
 * Re-make the sizes of the images uploaded before WebP (2026-11-23), a few at
 * a time, through POST /api/media-webp (apps/cms/src/lib/media-webp.ts). It
 * can stop and start again: images already in WebP are skipped.
 *
 *   node apps/cms/scripts/media-webp.mjs [--max N] [--limit N] [--dry]
 *
 * --max N   stop after N images (try a few first)
 * --limit N images per call (default 5, at most 20)
 * --dry     list what would be converted, change nothing
 *
 * Login: CMS_EMAIL / CMS_PASSWORD from the environment or from `.cms-import`
 * at the repo root (gitignored, never printed). CMS_URL defaults to
 * https://cms.akavish.gg. An editor account.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const UA = 'AkavishScout/1.0 (+https://akavish.gg)'

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

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : Number(process.argv[i + 1])
}

async function main() {
  const max = arg('--max', Infinity)
  const limit = arg('--limit', 5)
  const dry = process.argv.includes('--dry')
  const { email, password, url } = credentials()
  const api = `${url.replace(/\/+$/, '')}/api`
  const login = await fetch(`${api}/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ email, password }),
  })
  if (!login.ok) throw new Error(`Login failed (${login.status}).`)
  const { token } = await login.json()

  let after = 0
  let done = 0
  let errors = 0
  let before = 0
  let afterBytes = 0
  while (done + errors < max) {
    const res = await fetch(`${api}/media-webp`, {
      method: 'POST',
      headers: {
        Authorization: `JWT ${token}`,
        'content-type': 'application/json',
        'User-Agent': UA,
      },
      body: JSON.stringify({ after, limit: Math.min(limit, max - done - errors), dry }),
    })
    if (!res.ok) throw new Error(`media-webp: HTTP ${res.status} ${await res.text()}`)
    const page = await res.json()
    for (const r of page.results) {
      if (r.status === 'done') {
        done++
        before += r.before
        afterBytes += r.after
        console.log(
          `#${r.id} ${dry ? 'to convert' : `${Math.round(r.before / 1024)} KB → ${Math.round(r.after / 1024)} KB`}`,
        )
      } else {
        errors++
        console.log(`#${r.id} ERROR ${r.error}`)
      }
    }
    if (page.next == null) break
    after = page.next
    console.log(`… ${page.remaining} left`)
  }
  const kb = (n) => Math.round(n / 1024)
  console.log(
    dry
      ? `${done} image(s) to convert.`
      : `${done} converted, ${errors} error(s). Sizes: ${kb(before)} KB → ${kb(afterBytes)} KB.`,
  )
  if (errors) process.exitCode = 1
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
