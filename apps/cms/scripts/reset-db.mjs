/**
 * Reset a Postgres database — DESTRUCTIVE.
 * Drops and recreates the `public` schema, deleting ALL data (articles, users,
 * media records… everything). The CMS uses committed migrations (`push: false`),
 * so run `pnpm migrate` against this database after the reset; then open /admin
 * to create a fresh first user.
 *
 * No psql needed — uses the `pg` driver bundled with the CMS.
 *
 * Usage (from repo root: `pnpm reset:db …`, or here with `node scripts/reset-db.mjs …`):
 *   pnpm reset:db                 # wipes the DEV db (DATABASE_URL from apps/cms/.env)
 *   pnpm reset:db "<DATABASE_URL>" # wipes a specific db (e.g. prod) by URL
 *   pnpm reset:db --yes            # skip the confirmation prompt
 *
 * Combine with `pnpm clean` (separate) if you also want to wipe build artifacts.
 */
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const cmsDir = resolve(scriptDir, '..') // apps/cms

const args = process.argv.slice(2)
const skipPrompt = args.includes('--yes')
const urlArg = args.find((a) => !a.startsWith('--'))

// Resolve the target DB URL: explicit arg wins, else DATABASE_URL from apps/cms/.env.
function readEnvDatabaseUrl() {
  try {
    const env = readFileSync(resolve(cmsDir, '.env'), 'utf8')
    const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='))
    return line ? line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '') : ''
  } catch {
    return ''
  }
}

const url = urlArg || readEnvDatabaseUrl()

if (!url) {
  console.error('❌ No database URL. Pass one as an argument, or set DATABASE_URL in apps/cms/.env.')
  process.exit(1)
}

const masked = url.replace(/:\/\/[^@]+@/, '://***:***@')

async function confirm() {
  if (skipPrompt) return true
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(
    `⚠️  This PERMANENTLY DELETES all data in:\n    ${masked}\n    Type "reset" to confirm: `
  )
  rl.close()
  return answer.trim() === 'reset'
}

if (!(await confirm())) {
  console.log('Aborted. Nothing was changed.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  console.log('✅ Database reset to empty.')
  console.log('   → Run `pnpm --filter akavish-cms migrate` to rebuild the tables,')
  console.log('     then open /admin to create a new first admin user.')
} catch (err) {
  console.error('❌ Reset failed:', err.message)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
