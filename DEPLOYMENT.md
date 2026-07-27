# Deploying Akavish

This guide takes Akavish from local dev to production. Read it top to bottom the
first time — the order matters (database → CMS → web → search → domains).

## Architecture in production

Three long-lived pieces plus supporting services:

| Piece | What it is | Recommended host | Notes |
|-------|-----------|------------------|-------|
| **Web** (`apps/web`) | Next.js frontend | **Vercel** | Serverless, scales to zero. Has workspace deps, so Vercel builds from the repo root. |
| **CMS** (`apps/cms`) | Payload admin + API | **Railway** or **Render** (or a VPS) | Needs a **long-running Node process** — it is NOT static and won't run on Vercel's static/serverless model well. Fully standalone (no workspace deps). |
| **Database** | PostgreSQL | **Neon** (or Supabase) | Use a separate prod project/branch from dev. |
| **Search** | Meilisearch | **Meilisearch Cloud** or self-hosted (Docker on the same VPS/Railway) | Optional at launch — the site works without it, search just reports unavailable. |
| **Media** | Cloudflare R2 | Cloudflare | *Not wired yet* — see backlog. Until then, uploaded media lives on the CMS host's disk (ephemeral on some hosts). |

```
 Reader ──▶ Vercel (web, akavish.gg) ──REST──▶ CMS host (cms.akavish.gg) ──▶ Postgres (Neon)
                                                     │
                                                     └──▶ Meilisearch (search)
```

---

## 0. Before you start

- A **GitHub repo** with the code pushed (CI should be green — see the badge in the README).
- Accounts: Vercel, Railway or Render, Neon, Clerk (you already have dev keys),
  and optionally Meilisearch Cloud + Cloudflare.
- A **domain** (e.g. `akavish.gg`) if you want a custom URL.

> ⚠️ **Generate real DB migrations first.** In dev the CMS runs Payload in *push
> mode* (it auto-syncs the schema on boot). That's convenient locally but unsafe
> in production, where an unexpected schema change can drop data. See
> [§5 Migrations](#5-database-migrations-do-this-before-first-prod-deploy).

---

## Phase 1 — go live on platform URLs (no custom domain)

Don't have a domain yet? Ship first on the free URLs the platforms give you
(`*.up.railway.app`, `*.vercel.app`), then add a custom domain later
([Phase 2 = §6](#6-domains--dns)). Order matters — the CMS must exist before the
web can point at it.

1. **CMS on Railway** (root dir = repo root; build
   `pnpm install --frozen-lockfile && pnpm --filter akavish-cms build`,
   start `pnpm --filter akavish-cms start`). Env vars:
   - `DATABASE_URL` = your **prod** Neon URL
   - `PAYLOAD_SECRET` = a long random string (reuse the existing one if the DB
     already has content, so existing logins stay valid)
   - Leave `SERVER_URL` / `WEB_URL` unset for now (defaults are harmless) — you'll
     set them in step 3.
   - Skip Meilisearch for now (search will just report "unavailable").

   Deploy → note the URL Railway gives you, e.g. `https://akavish-cms.up.railway.app`.
   Open `…/admin` and create the first admin user (or log in if the DB already
   has one). Confirm `…/api/articles?limit=1` returns JSON.

2. **Web on Vercel** (root dir `apps/web`; Vercel auto-installs from the repo root).
   Env vars (Production scope):
   - `CMS_URL` = the Railway URL from step 1
   - `NEXT_PUBLIC_SITE_URL` = your Vercel URL (you can set it after the first
     deploy once you know it, then redeploy) — e.g. `https://akavish.vercel.app`
   - `NEXT_PUBLIC_APP_URL` = same Vercel URL
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` = your Clerk keys
     (the `pk_test_…` / `sk_test_…` dev keys are fine for this phase)

   Deploy → note the Vercel URL.

3. **Wire CORS back to the web.** On the Railway CMS, set `WEB_URL` to the Vercel
   URL and redeploy. (Server-side fetches work without this, but browser calls
   like Clerk need the origin allowed.)

4. **Check:** open the Vercel URL → published articles from the CMS show up.
   Sign-up/login works. `…/sitemap.xml` responds.

That's a working production deploy. When you get `akavish.gg`, do
[§6](#6-domains--dns): add the domains, set DNS, then swap the four URL env vars
(`SERVER_URL`, `WEB_URL`, `CMS_URL`, `NEXT_PUBLIC_SITE_URL`) to the real domain
and redeploy both. Also switch Clerk to **production** keys then.

> **Migrations in Phase 1:** if your prod DB already has the schema (e.g. it was
> your old dev DB), push mode is a no-op on boot and you're fine. Adopt versioned
> migrations ([§5](#5-database-migrations-do-this-before-first-prod-deploy))
> before you start making schema changes against real data.

---

## 1. Production database (Neon)

1. Create a new Neon project (or a `production` branch separate from dev).
2. Copy its pooled connection string — this is your prod `DATABASE_URL`
   (`postgresql://…?sslmode=require`).
3. Keep it handy; both the CMS host and migrations need it.

---

## 2. CMS → Railway (or Render)

The CMS has no workspace deps, but it's still a **pnpm workspace member** — the
lockfile lives at the repo root. So install from the **repo root** and target the
CMS with `--filter`, rather than installing inside `apps/cms` (which has no
lockfile of its own).

### Railway

1. **New Project → Deploy from GitHub repo**, pick the Akavish repo.
2. In the service settings:
   - **Root Directory:** leave as the repo root (`.`)
   - **Build Command:** `pnpm install --frozen-lockfile && pnpm --filter akavish-cms build`
     — Railway's builder has no separate "install" field; it auto-installs, but
     folding install into the build command makes it explicit and frozen.
   - **Start Command:** `pnpm --filter akavish-cms start`
   - **Node version:** 20 or 22 (`NODE_VERSION` env var, or the repo `.nvmrc`).
3. **Variables** (see the [env reference](#environment-variable-reference)):
   `DATABASE_URL`, `PAYLOAD_SECRET`, `SERVER_URL`, `WEB_URL`, and (if using search)
   `MEILISEARCH_HOST` + `MEILISEARCH_API_KEY`.
4. Get the public URL: **Settings → Networking → Generate Domain** →
   `https://<something>.up.railway.app`. Sanity-check it:
   `https://<url>/api/articles?limit=1` should return JSON.
5. (Optionally) set `SERVER_URL` to that URL. On first boot the schema syncs
   (push mode) or migrations run (see §5); then open `/admin` to create/log in as
   the admin.

> ⚠️ **Railway auto-creates one service per workspace package.** Because this is
> a pnpm monorepo, Railway may spawn extra services like `akavish-cms`,
> `@akavish/web`, `@akavish/mobile` alongside the one you configured. **Keep only
> the single service you set up with the build/start commands + env vars above,
> and delete the auto-created extras** (Settings → Delete Service). We deploy
> only the CMS on Railway — the web goes to Vercel, the mobile isn't deployed.
> The service's *name* doesn't matter; what matters is that it has the correct
> config and a successful build.

**Render** is equivalent: New **Web Service**, root dir `apps/cms`, same build/start
commands and env vars.

> **Docker alternative (advanced):** `apps/cms/Dockerfile` is the Payload starter.
> It targets a single-app build and needs `output: 'standalone'` in
> `next.config.ts` plus monorepo-aware `COPY` paths. The managed buildpack path
> above is simpler and recommended; only reach for Docker if your host requires it.

---

## 3. Web → Vercel

1. **Add New → Project**, import the Akavish repo.
2. Settings:
   - **Root Directory:** `apps/web` (Vercel auto-detects the pnpm workspace and
     installs from the repo root so the `@akavish/*` packages resolve).
   - **Framework preset:** Next.js (auto).
   - Build/Install commands: leave default (Vercel runs `pnpm install` + `next build`).
3. **Environment variables** (Production scope): the Clerk keys, `CMS_URL`
   (your prod CMS URL from §2), `NEXT_PUBLIC_SITE_URL` (e.g. `https://akavish.gg`),
   `NEXT_PUBLIC_APP_URL`, and search keys if used. See the reference below.
4. Deploy. Vercel gives you a `*.vercel.app` URL; add your domain in §6.

> Use **production** Clerk keys here, not the `pk_test_…` / `sk_test_…` dev ones.
> Create a production instance in the Clerk dashboard.

---

## 4. Search in production (optional)

Two options:

- **Meilisearch Cloud** — create a project, grab the host + a key, set
  `MEILISEARCH_HOST` and `MEILISEARCH_API_KEY` on the CMS (admin/master key) and
  `MEILISEARCH_HOST` + `MEILISEARCH_SEARCH_KEY` on the web (a search-only key).
- **Self-hosted** — run the `getmeili/meilisearch` container on the same
  Railway/VPS with a strong `MEILI_MASTER_KEY`.

Then backfill once from the CMS host (or locally against the prod DB + Meili):

```bash
pnpm --filter akavish-cms reindex:search
```

If you skip search at launch, leave `MEILISEARCH_HOST` unset — indexing is skipped
and the search box reports "unavailable"; the rest of the site works.

---

## 5. Database migrations (do this BEFORE first prod deploy)

Payload runs in **push mode** in dev. For production, generate versioned
migrations and run them explicitly so schema changes are reviewed, not
auto-applied.

```bash
cd apps/cms

# 1. Generate the initial migration from the current schema (writes to src/migrations)
pnpm migrate:create initial

# 2. Commit the generated migration files.

# 3. On the prod DB, apply migrations (run in the deploy pipeline or once by hand
#    with DATABASE_URL pointing at prod):
pnpm migrate

# Check state anytime:
pnpm migrate:status
```

Wire `pnpm migrate` into the CMS host's **release/pre-deploy** step so every
deploy applies pending migrations before the new code starts.

> Until you cut over to migrations, be aware push mode will try to sync the prod
> schema on boot — fine for the very first deploy of an empty DB, risky for
> changes afterward.

---

## 6. Domains & DNS

| Subdomain | Points to | Purpose |
|-----------|-----------|---------|
| `akavish.gg` (+ `www`) | Vercel | Public site |
| `cms.akavish.gg` | Railway/Render | CMS admin + API |
| `media.akavish.gg` | Cloudflare R2 | Media CDN (later) |

- Add the domain in Vercel → it gives you the DNS records (A/CNAME).
- Point `cms.akavish.gg` at the CMS host per their custom-domain docs.
- After DNS is live, update env: `NEXT_PUBLIC_SITE_URL=https://akavish.gg`,
  `CMS_URL=https://cms.akavish.gg`, `SERVER_URL=https://cms.akavish.gg`,
  `WEB_URL=https://akavish.gg`. Redeploy both apps so CORS/canonical/OG URLs are right.

---

## 7. Post-deploy checklist

- [ ] Migrations applied (`pnpm migrate:status` shows all run).
- [ ] Created the first CMS admin user at `https://cms.akavish.gg/admin`.
- [ ] Published a test article → it appears on `https://akavish.gg`.
- [ ] `https://akavish.gg/sitemap.xml` and `/robots.txt` return prod URLs.
- [ ] Clerk **production** keys in place; sign-up/login works on the live domain
      (add the domain to Clerk's allowed origins).
- [ ] CORS: the CMS `WEB_URL` matches the live web origin (else the browser
      blocks client calls — server-side fetches are unaffected).
- [ ] Search backfilled (if enabled) and the header search returns results.
- [ ] Set an **email adapter** on the CMS (see backlog) so password resets work —
      by default Payload logs emails to the console.

---

## Environment variable reference

**Web (Vercel)**

| Var | Example | Notes |
|-----|---------|-------|
| `CMS_URL` | `https://cms.akavish.gg` | Server-side fetch target |
| `NEXT_PUBLIC_SITE_URL` | `https://akavish.gg` | Canonical/SEO base |
| `NEXT_PUBLIC_APP_URL` | `https://akavish.gg` | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` | **Prod** Clerk key |
| `CLERK_SECRET_KEY` | `sk_live_…` | **Prod** Clerk key |
| `MEILISEARCH_HOST` | `https://…meilisearch.io` | Optional |
| `MEILISEARCH_SEARCH_KEY` | `…` | Optional, search-only key |

**CMS (Railway/Render)**

| Var | Example | Notes |
|-----|---------|-------|
| `DATABASE_URL` | `postgresql://…?sslmode=require` | Prod Neon |
| `PAYLOAD_SECRET` | long random string | Generate fresh for prod |
| `SERVER_URL` | `https://cms.akavish.gg` | The CMS's own public URL |
| `WEB_URL` | `https://akavish.gg` | Allowed CORS/CSRF origin |
| `MEILISEARCH_HOST` | `https://…` | Optional |
| `MEILISEARCH_API_KEY` | master key | Optional, write access for indexing |

---

## Recap

1. Prod Postgres (Neon).
2. `pnpm migrate:create initial` + commit.
3. CMS on Railway/Render (root `apps/cms`), env set, `pnpm migrate`, create admin.
4. Web on Vercel (root `apps/web`), prod Clerk keys + `CMS_URL` + `NEXT_PUBLIC_SITE_URL`.
5. (Optional) Meilisearch + `reindex:search`.
6. Domains + DNS, then update URLs and redeploy.
7. Walk the post-deploy checklist.
