// Load apps/cms/.env (CI passes DATABASE_URL / PAYLOAD_SECRET as env vars).
import 'dotenv/config'

// The integration tests create and delete documents. Same guard as `pnpm seed`:
// never let them anywhere near a real database.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal'])
const raw = process.env.DATABASE_URL
if (!raw) throw new Error('[test:int] DATABASE_URL is not set (apps/cms/.env).')
const host = new URL(raw).hostname
if (!LOCAL_HOSTS.has(host)) {
  throw new Error(`[test:int] Refusing to run against "${host}": integration tests write to the database, local only.`)
}
