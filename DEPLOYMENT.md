# Deploying Akavish

This guide takes Akavish from local dev to production. Read it top to bottom the
first time — the order matters (database → CMS → web → search → domains).

## Architecture in production

Three long-lived pieces plus supporting services:

| Piece                | What it is          | Recommended host                                                      | Notes                                                                                                                                                  |
| -------------------- | ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Web** (`apps/web`) | Next.js frontend    | **Vercel**                                                            | Serverless, scales to zero. Has workspace deps, so Vercel builds from the repo root.                                                                   |
| **CMS** (`apps/cms`) | Payload admin + API | **Railway** or **Render** (or a VPS)                                  | Needs a **long-running Node process** — it is NOT static and won't run on Vercel's static/serverless model well. Fully standalone (no workspace deps). |
| **Database**         | PostgreSQL          | **Neon** (or Supabase)                                                | Use a separate prod project/branch from dev.                                                                                                           |
| **Search**           | Meilisearch         | **Meilisearch Cloud** or self-hosted (Docker on the same VPS/Railway) | **Optional** — without it `/api/search` falls back to querying the CMS (Postgres `ILIKE`), so search works anyway. Meilisearch adds typo tolerance + ranking. See [§4](#4-search-in-production-optional). |
| **Media**            | Cloudflare R2       | Cloudflare                                                            | Uploads go to R2 via its S3-compatible API (`@payloadcms/storage-s3`). Required in prod — the CMS host's disk is ephemeral. See [§4b](#4b-media-storage-cloudflare-r2). |
| **Email (send)**     | Resend              | Resend                                                                | Transactional mail from the CMS (`@payloadcms/email-resend`). Required in prod — without it password resets silently go nowhere. See [§4c](#4c-transactional-email-resend). |
| **Email (receive)**  | Cloudflare Email Routing | Cloudflare                                                       | Forwards `hello@`/`tips@`/`privacy@` to a personal inbox. Receive-only. See [§6.6](#66-email-on-the-domain-free-via-cloudflare). |

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

> ⚠️ **Apply the committed migrations first.** Akavish uses versioned migrations
> in every environment (`push: false`); the database schema is never auto-synced
> on boot. See [§5 Database schema](#5-database-schema-how-tables-get-created-read-this).

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
   - Skip Meilisearch for now — search falls back to the CMS and still works (§4).

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

> **Migrations:** both the dev and prod databases use the committed migration
> history. Payload runs with `push: false`, so it never changes a schema on boot.
> Before a brand-new database can serve the CMS, run the committed migrations as
> described in [§5](#5-database-schema-how-tables-get-created-read-this).

---

## Day-to-day workflow (dev → prod)

Once deployed, this is the loop for everyday changes.

### Develop locally

Everything runs on your machine, against a **local Postgres in Docker** —
production is never touched.

```bash
# Once per session — local Postgres (+ Meilisearch)
docker compose up -d
# Terminal 1 — CMS on :3001 (uses apps/cms/.env → local Docker Postgres)
cd apps/cms && pnpm devsafe
# Terminal 2 — web on :3000 (uses apps/web/.env → talks to local CMS)
cd apps/web && pnpm dev
```

|                           | Database it uses | Config source                             |
| ------------------------- | ---------------- | ----------------------------------------- |
| **Local** (`pnpm dev`)    | Docker Postgres  | your local `.env` files (gitignored)      |
| **Live** (Railway/Vercel) | **prod** Neon DB | env vars set in each platform's dashboard |

Content you create locally lands in the local DB; prod content is separate. On a
fresh local DB, run `pnpm migrate` once before starting the CMS, then create an
admin at `localhost:3001/admin` and add test data. To get a realistic copy of
production instead, restore last night's backup into it (§9).

> There used to be a separate **dev project on Neon** (and a dev environment on
> Railway). Both were deleted in November 2026: they held credentials at vendors
> for no benefit, and the Railway one was among the variables exposed in the
> October incident without anyone remembering it existed.

### Ship to production

```bash
git add -A && git commit -m "…" && git push
```

Railway and Vercel are connected to the GitHub repo and **auto-deploy on push to
`main`** — but with a **monorepo path filter**: each platform only rebuilds when
the push touched _its_ app's files.

- Changed `apps/web/**` → **Vercel** redeploys the web.
- Changed `apps/cms/**` → **Railway** redeploys the CMS.
- Changed only docs / `.env.example` / the _other_ app → the platform **skips**
  the build (nothing to deploy — this is expected, not a bug).

**Env-var changes are the exception:** they live in the dashboards, not in git,
so after editing a variable you must **redeploy manually** for it to apply.

### Force a deploy manually

- **Vercel** → Deployments → latest → `⋯` → **Redeploy**.
- **Railway** → service → Deployments → **Deploy**.

### Where to read production errors

Works locally but breaks live? Check the logs:

- **Web** → Vercel → your project → the deployment → **Logs** (build + runtime).
- **CMS** → Railway → the service → **Deployments / Logs**.

### Verify auto-deploy is on

- **Vercel** → Settings → **Git** → Production Branch = `main`, repo connected.
- **Railway** → service → Settings → **Source** → branch = `main`, deploy trigger on.

---

## 1. Production database (Neon)

1. Create a Neon project for production (local development uses Docker, see
   *Develop locally*).
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
5. (Optionally) set `SERVER_URL` to that URL. Apply the committed migrations
   before the first boot (see §5), then open `/admin` to create/log in as the
   admin.

> ⚠️ **Railway auto-creates one service per workspace package.** Because this is
> a pnpm monorepo, Railway may spawn extra services like `akavish-cms`,
> `@akavish/web`, `@akavish/mobile` alongside the one you configured. **Keep only
> the single service you set up with the build/start commands + env vars above,
> and delete the auto-created extras** (Settings → Delete Service). We deploy
> only the CMS on Railway — the web goes to Vercel, the mobile isn't deployed.
> The service's _name_ doesn't matter; what matters is that it has the correct
> config and a successful build.

**Render** is equivalent: New **Web Service**, root dir `apps/cms`, same build/start
commands and env vars.

> **Docker alternative:** `apps/cms/Dockerfile` builds a production image of the
> CMS (§10). The managed path above is simpler and is what production uses; the
> image is there for a host that needs a container.

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

> Clerk keys: **production** (`pk_live_…` / `sk_live_…`) on the Production scope,
> development (`pk_test_…`) on Preview, since live keys only work on the real
> domain. Production since 2026-11-10 — §6.5.

**Preview deploys.** Vercel builds every branch and pull request on its own and
posts the link on the PR ("Vercel Preview Comments"); confirmed on 2026-11-06
with the first Dependabot PR. A preview reads the **production** CMS (it uses
the same `CMS_URL`), so it shows real published content and never writes to it.
Previews live on `*.vercel.app` and aren't indexed (Vercel adds
`X-Robots-Tag: noindex` to them). Nothing to configure.

---

## 4. Search in production (optional)

**Search works with no setup at all.** `/api/search` has two backends and picks
whichever is available:

| `MEILISEARCH_HOST` | Backend                | Behaviour                                                  |
| ------------------ | ---------------------- | ---------------------------------------------------------- |
| unset              | CMS → Postgres `ILIKE` | Every word of the query must appear in the title, or in the excerpt. Newest first. Free. |
| set                | Meilisearch            | Typo-tolerant, ranked by relevance.                         |

The CMS path is also the safety net: if Meilisearch is configured but down, or
its index doesn't exist yet, the route quietly falls back instead of erroring.
The search box lives in the global header, so a hard failure there would be
visible on every page.

**Akavish currently runs on the CMS fallback** — Meilisearch Cloud starts at
$20/month and typo tolerance isn't worth paying for at this article count. The
integration stays wired and switching on is one env var.

### Upgrading to Meilisearch

- **Meilisearch Cloud** — create a project, grab the host + keys. No free tier
  (14-day trial, then from $20/month).
- **Self-hosted** — run the `getmeili/meilisearch` container on Railway or a VPS
  with a strong `MEILI_MASTER_KEY`. Cheapest real option.

Then set, on the **CMS** (it writes to the index):

```bash
MEILISEARCH_HOST=https://…
MEILISEARCH_API_KEY=<master/admin key>
```

and on the **web** (it only reads):

```bash
MEILISEARCH_HOST=https://…
MEILISEARCH_SEARCH_KEY=<search-only key>
```

Backfill once, from the CMS host or locally against the prod DB + Meili:

```bash
pnpm --filter akavish-cms reindex:search
```

Confirm the switch took: `/api/search?q=test` returns `"engine":"meilisearch"`
rather than `"engine":"cms"`.

---

## 4b. Media storage: Cloudflare R2

**Why this is required in production:** Payload writes uploads to the local disk
by default, and Railway's filesystem is **ephemeral** — every redeploy or restart
wipes it, so article images 404. R2 is object storage: files persist and are
served from a public URL.

R2 exposes an S3-compatible API, so we use `@payloadcms/storage-s3` (the
`@payloadcms/storage-r2` adapter is for Cloudflare Workers only). The plugin is
wired in `apps/cms/src/payload.config.ts` and turns itself **off when `R2_BUCKET`
is unset**, so a fresh clone still runs on local disk.

### Create the bucket

1. Cloudflare dashboard → **R2** → **Create bucket** (e.g. `akavish-media`).
2. **Make the files publicly readable** — R2 buckets are private by default:
   bucket → **Settings → Custom Domains → Connect** `media.akavish.gg` (what
   prod uses: cached by Cloudflare). The **r2.dev subdomain** also works for a
   quick test, but Cloudflare rate-limits it and doesn't cache it. This public
   URL is what serves the images.
3. **R2 → Manage API tokens** → create a token with **Object Read & Write** scoped
   to that bucket. Note the **Access Key ID**, **Secret Access Key**, and the
   **S3 API endpoint** (`https://<accountId>.r2.cloudflarestorage.com`).

### Configure the env vars

On the **CMS** (Railway variables, and `apps/cms/.env` locally):

```bash
R2_BUCKET=akavish-media
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://<accountId>.r2.cloudflarestorage.com   # uploads only
R2_PUBLIC_URL=https://media.akavish.gg                     # serves the files
```

On the **web** (Vercel), so `next/image` is allowed to load from that host:

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://media.akavish.gg
```

Redeploy both. New uploads now land in R2 and survive redeploys.

> **Set the same R2 values locally too.** The storage plugin adds a `prefix`
> field to the media collection when it's enabled — if it's on in prod but off in
> dev, the two schemas drift. Configuring both keeps migrations honest.

> **Existing images:** files uploaded before R2 lived on the old disk and are
> already gone. Re-upload them in the admin — new ones persist.

---

## 4c. Transactional email: Resend

**Why this matters:** with no email adapter Payload doesn't fail loudly — it just
**logs emails to the console**. The "forgot password" flow appears to work while
the reset link goes nowhere, so a lost admin password locks you out of `/admin`
permanently. This is the only thing standing between you and that.

`@payloadcms/email-resend` talks to Resend's REST API (no SMTP). It's wired in
`apps/cms/src/payload.config.ts` and turns itself **off when `RESEND_API_KEY` is
unset**, falling back to console logging — so a fresh clone runs with no account.

> Not to be confused with **Cloudflare Email Routing** (§6.6), which only
> **receives** and forwards `hello@`/`tips@`/`privacy@` to a personal inbox.
> Resend only **sends**. You need both; they don't overlap.

### Verify a sending domain

1. [resend.com](https://resend.com) → sign up (free tier: 3 000 emails/month,
   100/day) → **Domains → Add Domain**.
2. Use the **subdomain `mail.akavish.gg`**, not the apex. Resend recommends a
   subdomain to isolate sending reputation, and it keeps Resend's records well
   clear of the Cloudflare Email Routing records already sitting on the apex.
3. Resend lists DNS records (MX + SPF `TXT` + DKIM `TXT`) → add them in
   **Cloudflare → DNS → Records**, each **DNS only** (grey cloud).

   ⚠️ Before saving, check that none of them is an **MX on the apex
   `akavish.gg`** — that would fight with Email Routing and break incoming mail.
   Scoped to `mail.akavish.gg`, they can't collide.
4. Wait for the domain to read **Verified**, then **API Keys → Create API Key**
   (*Sending access* is enough).

### Configure the env vars

On the **CMS** (Railway variables, and `apps/cms/.env` locally):

```bash
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=noreply@mail.akavish.gg   # must be on the verified domain
EMAIL_FROM_NAME=Akavish
```

Redeploy the CMS. Test it end to end: `/admin` → **Forgot password** → the mail
should land in your inbox and its link should open the reset form.

> The reset email is a branded template
> (`apps/cms/src/lib/emails/forgot-password.ts`) whose button points at
> `${SERVER_URL}/admin/reset/<token>` — so a wrong `SERVER_URL` on Railway gives
> you a good-looking email with a dead link. Worth clicking once after any
> domain change.

> **Newsletter.** The same setup sends the newsletter confirmation emails
> (`apps/cms/src/lib/newsletter.ts`), with links to `${WEB_URL}/newsletter/confirm`:
> `WEB_URL` on Railway must be `https://akavish.gg`. Test once after deploying:
> sign up in the site's footer with your own address, click the link, and check
> the subscriber shows as *Confirmed* in `/admin` → Subscribers (done on
> 2026-11-09, worked first time). Mind the free
> tier (100 emails/day) once real issues go out.

> Sends fail with a 4xx from Resend if `EMAIL_FROM_ADDRESS` isn't on a verified
> domain — Payload surfaces it as an `APIError` in the CMS logs (§ "Where to read
> production errors"). Until the domain is verified, Resend only accepts sends to
> your own account address, so test with that.

---

## 4d. Observability: analytics, errors, uptime

Three separate concerns: **who visits** (Vercel Web Analytics), **what breaks**
(Sentry) and **whether it's up at all** (UptimeRobot). All on free tiers; the
first two no-op without configuration, the third lives entirely outside the code.

### Vercel Web Analytics (traffic)

`<Analytics />` sits in the web root layout, mounted once the page has loaded
(`components/DeferredAnalytics.tsx`: injected earlier, a blocked script could
break hydration, see PROGRESS gotchas). Nothing to configure in code —
enable it in the **Vercel dashboard → project → Analytics**, redeploy, done.

- **Free tier: 50 000 events/month** on Hobby, shared across all projects on the
  account. Collection *pauses* at the limit rather than billing you.
- **Cookieless and no personal data**, which is why the site carries no consent
  banner. If you later add anything that does set cookies or profile users, that
  changes — revisit `/privacy` at the same time.
- Only collects on Vercel deployments; a no-op locally.
- Enabling it adds routes under `/_vercel/insights/*`. The Clerk middleware
  matcher already excludes `_vercel`, so the beacons don't run through auth.

### Sentry (errors + performance)

Create **two projects** at [sentry.io](https://sentry.io) — one for the web app,
one for the CMS — so a frontend flood doesn't bury a database incident.

| Where   | Variable                         | Notes                                       |
| ------- | -------------------------------- | ------------------------------------------- |
| Vercel  | `NEXT_PUBLIC_SENTRY_DSN`         | Web project DSN. Public by design.          |
| Vercel  | `SENTRY_ORG` / `SENTRY_PROJECT`  | Build-time, for source maps                 |
| Vercel  | `SENTRY_AUTH_TOKEN`              | **Secret.** Build-time only                 |
| Railway | `SENTRY_DSN`                     | CMS project DSN — *not* `NEXT_PUBLIC_`      |
| Railway | `SENTRY_ORG` / `SENTRY_PROJECT_CMS` | Build-time, for source maps              |
| Railway | `SENTRY_AUTH_TOKEN`              | **Secret.** Build-time only                 |

Notes on how it's wired:

- **No DSN → Sentry does nothing.** Fresh clones and CI build with no account.
- **The auth token is optional.** Without it the build succeeds and simply skips
  the source map upload; stack traces are then minified and much harder to read.
- **Web tunnels through `/monitoring`** (`tunnelRoute` in `next.config.ts`). Ad
  blockers block `sentry.io` outright, and a gaming audience runs a lot of them —
  without the tunnel you'd silently lose exactly those readers' errors. The
  Clerk middleware matcher and `robots.ts` both exclude that path.
- **The CMS has no browser SDK** — one editor, a heavy admin bundle, and the
  errors worth catching there are server-side anyway.
- **Sampling**: traces are 10% in production on the web, 50% on the CMS (far
  fewer requests). The free tier gives 5 000 errors + 10 000 performance units a
  month; traces eat the latter quickly. Tune in each app's `lib/sentry-shared.ts`.
- **Personal data collection is explicitly disabled** (`NO_PII_DATA_COLLECTION`
  in each app's `lib/sentry-shared.ts`): no IP address, cookies, headers, request
  bodies, query params or stack-frame variables. SDK v10's `dataCollection`
  defaults are permissive, so this is set by hand rather than relied on —
  `/privacy` and `/fr/confidentialite` promise this behaviour by name.
- **Session Replay is off** on purpose — it records what readers see, a far
  bigger promise than "we log errors", and it's the heaviest thing the browser
  SDK can load. Turning it on means rewriting the privacy pages first.

**Source maps confirmed (2026-11-06):** `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` /
`SENTRY_PROJECT(_CMS)` set on Vercel and Railway, builds upload them, stack
traces in Sentry show the real `.tsx` files. If traces ever turn minified again,
check those three variables first, then the build log for "No auth token".

Verify after deploying: throw a test error from a page, then check **Issues** in
Sentry. `/api/search?q=x` and a normal page view should also appear under
**Traces**.

### UptimeRobot (is it up?)

Sentry only reports errors from a process that is running; if Railway or Neon
goes down, nothing reports anything (the October 2026 Railway outage was found
by email). An external probe closes that gap. Set up on 2026-11-06, free plan
(checks every 5 min, alerts by email), no code or env vars involved:

| Monitor | Type | URL | Up when |
| --- | --- | --- | --- |
| `Akavish web` | HTTP(S) | `https://akavish.gg` | 2xx/3xx |
| `Akavish CMS + DB` | **Keyword** | `https://cms.akavish.gg/api/articles?limit=1&depth=0` | the body contains `totalDocs` (alert when it doesn't) |

The CMS probe hits the REST API rather than `/admin` because that query goes
through Postgres: a Neon outage turns it red too.

**Gotcha: don't make the CMS probe a plain HTTP(S) monitor.** UptimeRobot sends
`HEAD` by default, and Payload's API answers `HEAD` with **404** (it only
routes `GET`), so the monitor shows a permanent false "Down". A Keyword monitor
downloads the page with `GET`. The web monitor is fine with `HEAD` (Next pages
handle it).

The probe sees no visitor data, so it isn't listed in `lib/legal.ts`.
Planned maintenance (a risky migration, a DB restore): pause the monitors in
the dashboard first, or you'll get "Down" emails.

---

## 4e. Rate limiting, caching, logs

All three are in the code and need no setup; the optional upgrades below are
dashboard settings for when traffic justifies them.

**Rate limiting** (`apps/web/src/lib/rate-limit.ts`): per visitor IP, 30
requests/minute on `/api/search` and 120 on `/api/articles*`, then a **429**
with `Retry-After`. The counter lives in each server instance's memory, so on
Vercel it's approximate; it stops one client hammering search, which is the
realistic case today. On top of it, a **Vercel Firewall rule** counts across
instances (in place since 2026-11-09): Vercel → project → **Firewall → Rules**
→ rate limit on path `/api/search`, fixed window, 60 s, 30 requests, key IP,
action **429** (not 403: a 429 tells clients to slow down and retry). Further
upgrade if ever needed: a shared store (Upstash Redis) behind the same helper.

**Caching:** the API routes answer with `Cache-Control: public, s-maxage=60,
stale-while-revalidate=300`, so Vercel's CDN serves repeat requests (same
search, same article) without calling the function or the CMS; errors and
429s are `no-store`. Pages keep their ISR settings (articles and lists 30 s,
sitemap and RSS 5 min). Past those 30 s Next serves the old page once while it
rebuilds, which is why a new article took a few reloads to show on a category
page. **On-demand revalidation** (since 2026-11-11) fixes it: after a public
change (article published, edited, unpublished or deleted, game, tag, author)
the CMS posts to `https://akavish.gg/api/revalidate` with the header
`x-revalidate-secret`, and the site drops its CMS cache at once
(`apps/cms/src/lib/revalidate-web.ts`, `apps/web/src/app/api/revalidate`).
Needs **`REVALIDATE_SECRET`, the same value on Railway and Vercel**
(`openssl rand -hex 32`); unset on either side, nothing breaks, the 30 s timer
still applies. Check: publish something, the category page shows it on the
first reload; Railway logs say `[revalidate] web refused` if the secrets
differ. **Media** is served from `media.akavish.gg` (since
2026-11-09), the R2 bucket's custom domain, which Cloudflare caches; `*.r2.dev`
would be rate-limited and uncached. `R2_PUBLIC_URL` (Railway) and
`NEXT_PUBLIC_R2_PUBLIC_URL` (Vercel, type *Config*: a `NEXT_PUBLIC_` variable
can't be *Sensitive*, so recreate it rather than edit it) both point there.
Existing images followed: their URL is built from that variable at read time.

**Structured logs:** one JSON object per line on both apps, so fields are
searchable. Web (`lib/log.ts`): CMS errors and timeouts, search falling back
from Meilisearch, API failures, rate-limit hits; read them in Vercel →
project → **Logs** (filter on `level:error` or the message). CMS: Payload's
logger switches to JSON in production (`logger` in `payload.config.ts`), which
Railway parses: service → **Logs**, filter `@level:error`. Visitor IPs and
search terms are deliberately never logged. Retention is the platforms' own
(about a day on Vercel Hobby): enough to investigate an incident the same
day; ship them to an external store (e.g. Axiom's Vercel integration) if
longer history is ever needed.

## 5. Database schema: migrations (READ THIS)

Payload needs the DB tables (articles, users, media…) to exist. Akavish manages
them exclusively with **migrations**: versioned SQL files committed to git and
applied explicitly. This makes every schema change reviewed and repeatable in
both dev and prod. Payload's automatic *push mode* is disabled (`push: false` in
`payload.config.ts`), so starting the CMS never changes a database schema.

### One-time setup (adopting migrations)

Done once. Because the DBs already had tables from earlier push runs, we start
each DB fresh so its state matches the migration exactly.

```bash
cd apps/cms

# 1. DEV — wipe, generate the initial migration, apply it, commit.
pnpm reset:db --yes                       # wipes the dev DB (URL from apps/cms/.env)
pnpm migrate:create initial               # writes src/migrations/…
pnpm migrate                              # applies it to the dev DB
git add src/migrations && git commit -m "cms: initial migration" && git push

# 2. PROD — wipe, then apply the same migrations.
node scripts/reset-db.mjs '<PROD_DATABASE_URL>' --yes
DATABASE_URL='<PROD_DATABASE_URL>' pnpm migrate

# 3. Recreate the first admin (+ content) at each /admin:
#    dev  → http://localhost:3001/admin   (run `pnpm devsafe` first)
#    prod → https://<cms>.up.railway.app/admin
```

Then, on **Railway → service → Settings**, set a **Pre-Deploy Command**:

```
pnpm --filter akavish-cms migrate
```

so every production deploy applies pending migrations before the new code starts.

### Everyday workflow (after setup)

**When do you need a migration?** Only when you change the **database shape** —
i.e. you edit a **collection** in `apps/cms/src/collections/` (add/remove a field,
change a type, add a collection, a relationship, an index). Everything else is a
**normal push, no migration**: frontend changes (`apps/web`), publishing articles
(that's _data_, done in the admin), bug fixes, config, docs.

Schema change → generate + apply a migration:

```bash
cd apps/cms
pnpm migrate:create add_whatever   # generate a migration for the change
pnpm migrate                       # apply locally (dev)
git add src/migrations && git commit -m "…" && git push
```

On push, Railway's pre-deploy runs `pnpm migrate` → prod picks up the change
safely. No manual DB surgery, no drift between dev and prod.

**Is `pnpm migrate` destructive?** No — it's incremental. Adding a field is
`ALTER TABLE ADD COLUMN`; your existing rows are kept. It never wipes data. (The
change _itself_ can be destructive, e.g. removing a field drops that column — but
the migration file is reviewable, so there are no surprises.) The only destructive
commands are `pnpm migrate:fresh` and `pnpm reset:db`, which you run deliberately.

Useful commands: `pnpm migrate:status` (what's applied), `pnpm migrate:fresh`
(drop everything and re-run all migrations — destructive, for a clean rebuild).

**Plugins add columns too.** A migration is generated from the schema *as your
machine sees it*. The R2 storage plugin used to add its fields (`prefix`,
`_objectKey` on `media`) only when `R2_BUCKET` was set, so a migration generated
without R2 missed them and prod's media API answered 500 (`column "_objectkey"
does not exist`) from the Payload 3.93 upgrade until 2026-11-09.
`alwaysInsertFields: true` in `payload.config.ts` now keeps the schema the same
with or without R2. Same rule for any future plugin: its schema must not depend
on an env var, or the migration will differ between machines.

---

## 6. Domains & DNS

Setup: domain registered at **Porkbun**, DNS managed by **Cloudflare** (registrar
nameservers point to Cloudflare). Target layout:

| Hostname               | Points to     | Purpose                    |
| ---------------------- | ------------- | -------------------------- |
| `akavish.gg` (+ `www`) | Vercel        | Public site                |
| `cms.akavish.gg`       | Railway       | CMS admin + API            |
| `media.akavish.gg`     | Cloudflare R2 | Media CDN (R2 custom domain) |

> **Proxy status.** Vercel records are **DNS only** (grey cloud) — Vercel
> terminates its own TLS and runs its own CDN, and stacking Cloudflare's proxy in
> front invites certificate and double-caching problems. The Railway record for
> `cms.akavish.gg` is **Proxied** (orange) and works fine, so it was left as
> Railway created it. Just remember that anything proxied is subject to
> Cloudflare's bot/AI rules — if you ever tighten those, verify the web app can
> still reach the CMS API server-side.

> **Canonical host: the apex `akavish.gg`, no `www`.** `NEXT_PUBLIC_SITE_URL`,
> the sitemap, canonical tags and OG URLs all use it. In Vercel, `akavish.gg` is
> the **primary** domain and `www.akavish.gg` is a **308** redirect to it — not
> the other way around, or every URL in the sitemap would answer with a redirect.

### 6.1 Point the registrar at Cloudflare (do this first)

1. Cloudflare → **Add a site** → **Connect a domain** → `akavish.gg` → Free plan.
   Skip the DNS-record review (0 records on a fresh domain is expected).
2. Copy the two assigned nameservers (e.g. `elaine.ns.cloudflare.com`).
3. Porkbun → domain → **NAMESERVERS** → replace all four Porkbun entries with the
   two Cloudflare ones → save. DNSSEC must be **off** at the registry during the
   move (re-enable it from Cloudflare afterwards).
4. Wait for the “site is active” email (usually 10–30 min).

### 6.2 Web → Vercel

1. Vercel → project → **Settings → Domains** → add `akavish.gg`, then `www.akavish.gg`.
2. On `www.akavish.gg`, pick **Redirect to Another Domain** → `akavish.gg` with
   **308 Permanent Redirect**. Permanent (301/308) is what tells Google to
   consolidate on the apex; 302/307 are temporary and leave both hosts indexed.
   308 over 301 because it preserves the HTTP method (a POST stays a POST).
3. Vercel shows the required records → create them in **Cloudflare → DNS → Records**,
   each set to **DNS only**.

### 6.3 CMS → Railway

1. Railway → service → **Settings → Networking → Custom Domain** → `cms.akavish.gg`.
2. Railway returns a CNAME target → create the `cms` record in Cloudflare, **DNS only**.

### 6.4 Environment variables (then redeploy both)

| Where       | Variable               | Value                     |
| ----------- | ---------------------- | ------------------------- |
| Railway     | `SERVER_URL`           | `https://cms.akavish.gg`  |
| Railway     | `WEB_URL`              | `https://akavish.gg`      |
| Vercel      | `CMS_URL`              | `https://cms.akavish.gg`  |
| Vercel      | `NEXT_PUBLIC_SITE_URL` | `https://akavish.gg`      |
| Vercel      | `NEXT_PUBLIC_APP_URL`  | `https://akavish.gg`      |

Env changes only apply to a new build — **redeploy Vercel and Railway** after
saving. This is what makes canonical URLs, the sitemap, OG tags and CORS correct.

### 6.5 Clerk — production instance

**Status: live since 2026-11-10.** `akavish.gg` serves `pk_live_…`, Clerk's
Frontend API answers on `clerk.akavish.gg`, no "development mode" banner.
Google, Discord and Twitch sign-in run on Akavish's own OAuth apps since
2026-11-11, tested end to end. **X is switched off** (2026-11-11): its app is
created and its credentials stay saved in Clerk, but sign-in failed, most
likely because X's free API tier doesn't cover it. **When the paid X API plan
is taken** (the scout's step 3 needs it too): Clerk → SSO connections → X →
on, then test a sign-in. `/privacy` (EN + FR) and `lib/legal.ts` already
name X, so nothing else changes.

1. **Create the instance.** Clerk dashboard → *Go to production* → Application
   domain: **`akavish.gg`** (the apex, no `www`: `www` 308s to it). Clerk then
   serves its Frontend API from `clerk.akavish.gg` and the account pages from
   `accounts.akavish.gg`.
2. **DNS.** Clerk → *Configure → Domains* lists the records (about five CNAMEs:
   `clerk`, `accounts`, `clkmail`, `clk._domainkey`, `clk2._domainkey`). Add each
   in Cloudflare → DNS **with the proxy off** (grey cloud, *DNS only*): Clerk
   issues its own certificates and fails behind Cloudflare's proxy. Then
   *Verify configuration* in Clerk; the SSL certificates can take from a few
   minutes to a few hours.
3. **Settings.** A production instance starts from the development settings,
   except social logins: each provider (Google, Discord…) needs its own OAuth
   client ID and secret in production. Check *User & authentication* (email
   and/or password, sign-up allowed) and *Paths* (`/sign-in`, `/sign-up`, also
   set by `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_UP_URL`).
4. **Keys on Vercel.** Clerk → *API Keys* of the **production** instance →
   Vercel → Project → Settings → Environment Variables:
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_…` and `CLERK_SECRET_KEY` =
   `sk_live_…`, **Production scope only**. Keep the `pk_test_…` / `sk_test_…`
   pair on *Preview* and *Development*: live keys only work on `akavish.gg`, so
   preview deploys on `*.vercel.app` would break with them.
5. **Redeploy** production (the publishable key is baked in at build time) and
   check: the banner is gone, sign-up sends the code email from Clerk, sign-in
   and sign-out work, the page source loads `clerk.akavish.gg`.

6. **Social logins.** In production each provider needs its own OAuth app; the
   development instance used Clerk's shared ones. For each: Clerk → *User &
   authentication → SSO connections* → the provider → *Use custom credentials*,
   which shows the **redirect URI** to paste on the provider's side
   (`https://clerk.akavish.gg/v1/oauth_callback`), then paste back the client
   ID and secret.
   - **Google**: Google Cloud Console → new project `Akavish` → *Google Auth
     Platform*: app name, support email, authorized domain `akavish.gg`, home
     page, `/privacy` and `/terms` links, audience *External*, then
     *Publish app* (basic scopes need no review) → *Clients → Create client*,
     type *Web application*, the redirect URI.
   - **Discord**: discord.com/developers → *New Application* `Akavish` (not the
     scout bot's app) → *OAuth2*: add the redirect URI, copy client ID and
     secret.
   - **Twitch**: dev.twitch.tv/console → *Register your application*, category
     *Website Integration*, the redirect URI → client ID, *New Secret*.
   - **X**: developer.x.com → a project and app → *User authentication
     settings*: OAuth 2.0, type *Web App*, callback = the redirect URI,
     website `https://akavish.gg` → *Keys and tokens* → OAuth 2.0 client ID
     and secret. If X asks for a paid tier, disable X in Clerk instead.

   A provider without credentials shows its button but fails: switch it off
   in Clerk until its app is ready. `/privacy` (EN + FR) and the processor list
   (`lib/legal.ts`) name the four providers; change them if the list changes.

Users created on the development instance are not carried over (they were
tests). Nothing else in the code changes: the CMS doesn't use Clerk, and the
mobile app has no reader accounts yet.

### 6.6 Email on the domain (free, via Cloudflare)

Cloudflare **Email Routing** forwards `@akavish.gg` mail to a personal inbox, for
free. Order matters — a routing rule can't be created until a destination address
is verified:

1. **Email → Email Routing → enable.** Cloudflare adds the MX, SPF and DKIM
   records itself (they show as *Locked* in the DNS list — leave them alone).
2. **Destination Addresses → Add destination address** → the personal inbox.
   Cloudflare mails a verification link; click it so the address reads *Verified*.
3. **Routing rules → Create routing rule**, one per public address, each
   *Send to an email* → the verified destination:
   - `hello@akavish.gg` — advertised on `/contact` and `/terms`
   - `tips@akavish.gg` — advertised on `/contact`
   - `privacy@akavish.gg` — advertised on `/privacy`
4. Leave the **Catch-all** rule on *Drop / Disabled*: it would accept mail for
   every invented local part, which mostly means spam. The explicit rules are enough.

Keep these rules in sync with the addresses the site actually advertises — grep
for `mailto:` under `apps/web/src/app` before adding or removing one.

> ⚠️ Email Routing **receives only** — it cannot send. Transactional mail
> (Payload password resets) needs a separate provider such as Resend; see the
> email-adapter task in `PROGRESS.md`. The two are complementary, not redundant.

### 6.7 Post-cutover checks

All of these passed on the `akavish.gg` cutover — re-run them after any DNS or
domain change:

- `https://akavish.gg` serves the site; `https://cms.akavish.gg/admin` loads.
- `https://akavish.gg/sitemap.xml` and `/robots.txt` show the **new** domain and
  answer **directly** (no redirect — the apex must be primary).
- `https://www.akavish.gg/<any-path>` **308**s to the same path on the apex.
- Sign-up/login works on the live domain (dev Clerk keys are fine — see §6.5).
- Mail to `hello@akavish.gg` lands in the destination inbox.
- Re-enable **DNSSEC** from Cloudflare (DNS → Settings) — it gets dropped by the
  nameserver change.
- Update `apps/web/next.config.ts` / docs if the media host changes.

---

## 7. Post-deploy checklist

- [ ] Migrations applied (`pnpm migrate:status` shows all run).
- [ ] Created the first CMS admin user at `https://cms.akavish.gg/admin`.
- [ ] Both UptimeRobot monitors green (§4d).
- [ ] Published a test article → it appears on `https://akavish.gg`.
- [ ] `https://akavish.gg/sitemap.xml` and `/robots.txt` return prod URLs.
- [x] Sign-up/login works on the live domain with the Clerk **production**
      keys (`pk_live_…`, §6.5): no "development mode" banner (2026-11-10).
- [x] Social logins (Google, Discord, Twitch) have their own OAuth apps
      (§6.5 step 6, 2026-11-11).
- [ ] X sign-in: switched off in Clerk, credentials saved. Switch it back on
      and test once the paid X API plan is taken.
- [ ] CORS: the CMS `WEB_URL` matches the live web origin (else the browser
      blocks client calls — server-side fetches are unaffected).
- [ ] Search backfilled (if enabled) and the header search returns results.
- [ ] `RESEND_API_KEY` set on the CMS and **"Forgot password" actually delivers a
      mail** (§4c). Without it Payload silently logs emails to the console and a
      lost admin password is unrecoverable.

---

## 8. Secret rotation (incident runbook)

Use this when a host or vendor reports leaked credentials, when a secret has
been pasted somewhere it shouldn't (chat, screenshot, issue, commit), or as
periodic hygiene. Written after the **October 2026 Railway incident**, in which
Railway disclosed that customer environment variables may have been read and
asked every user to rotate everything.

**Rule one: assume exposed.** A provider's "you may be affected" means rotate.
Your own app logs prove nothing — an attacker uses stolen keys directly against
Neon, R2 or Resend, never through the CMS. Check *those* services' logs.

### Inventory

| Secret | Lives on | Revoke / reissue at | Breaks until redeploy | Severity |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Railway | Neon → **prod** project → Roles → *Reset password* | **CMS, and therefore the site's article pages** | 🔴 full DB access |
| `PAYLOAD_SECRET` | Railway | Generate: `openssl rand -base64 48` | Nothing — logs editors out once applied | 🔴 forge admin sessions |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Railway, local `.env` | Cloudflare → R2 → Manage API tokens | Uploads only — images keep serving from `R2_PUBLIC_URL` | 🟠 delete/plant files |
| `RESEND_API_KEY` | Railway, local `.env` | Resend → API Keys | Password-reset emails | 🟠 phishing from your domain |
| `SENTRY_AUTH_TOKEN` | Railway **and** Vercel | Sentry → Settings → Developer Settings → Organization Tokens | Nothing at runtime — build-time only | 🟡 |
| `CLERK_SECRET_KEY` | Vercel | Clerk → API Keys → roll | Reader sign-in, until Vercel redeploys | 🟠 reader accounts |
| `MEILISEARCH_API_KEY` | (unset today) | Meilisearch → keys | Search falls back to the CMS | 🟡 |
| `REVALIDATE_SECRET` | Railway **and** Vercel (same value) | Generate: `openssl rand -hex 32` | Instant refresh only, the 30 s cache still works | 🟡 flush the site's cache |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Railway / Vercel | Sentry → Client Keys | Nothing | ⚪ public by design |
| `BACKUP_DATABASE_URL` | GitHub secrets | Neon (same reset as above, or the `backup_ro` role) | Nightly backups fail | 🔴 if the owner role, 🟠 if read-only |
| `BACKUP_R2_*` | GitHub secrets | Cloudflare → R2 → the backups-bucket token | Nightly backups fail | 🔴 every past dump |

Not secrets, no action: `SERVER_URL`, `WEB_URL`, `CMS_URL`, `*_SITE_URL`,
`R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_URL`, `EMAIL_FROM_*`, `SENTRY_ORG`,
`SENTRY_PROJECT*`, `*_ENVIRONMENT`.

### Order of operations

New values only take effect on the **next deploy** — variables are bound to a
deployment, so a restart reuses the old ones. That makes the order matter:

1. **Zero-downtime first.** Sentry token, Resend key, R2 keys: revoke, reissue,
   paste the new values in Railway (and Vercel / local `.env` where listed). The
   live site keeps working throughout.
2. **`PAYLOAD_SECRET`.** Set the new value; harmless until the deploy.
3. **Database last.** Resetting the Neon password cuts the running CMS off
   immediately. Do it right before you can deploy — or immediately, accepting
   downtime, if Neon shows activity you don't recognise.
4. **Deploy once.** If the platform queues deploys, don't trigger it again.
   Ship rotations on their own — never in the same deploy as a dependency or
   build change, or a failure can't be attributed.

If the host has paused deployments (Railway did, for hours, by plan tier), steps
1–2 still apply safely; step 3 is the only judgement call.

### Pitfalls hit last time

- **Rotate every environment, not just production.** A host leak covers all of
  them. In October 2026 only Railway's `production` environment was rotated; a
  forgotten `dev` environment kept its old variables and was only found weeks
  later, when its deploy failed. List the host's environments before starting.
- **Neon project.** Reset the password on the **production** project. (There used
  to be a dev project with an identically named `neondb_owner` role — a copy-paste
  between the two fails with `password authentication failed`.)
- **Pooled vs direct.** Keep the same connection-string form as before (`-pooler`
  in the host or not), with `?sslmode=require` on the end.
- **Creating a key doesn't revoke the old one.** Delete the old R2 token / Resend
  key explicitly, then confirm the list shows only the new one.
- **Scope new keys minimally.** R2: *Object Read & Write* on the one bucket.
  Resend: *Sending access*. The Cloudflare `cfat_…` account token shown next to
  R2 credentials is not used by Akavish — don't store it anywhere.
- **Never paste a secret into a chat, ticket or screenshot** — including to an AI
  assistant. Copy straight from the provider's copy button into the dashboard.
  Nothing in this repo or its tooling ever needs the value itself.

### After the deploy

- `cms.akavish.gg/admin` → log in again (new `PAYLOAD_SECRET`) → **Users**: no
  account you don't recognise.
- Upload a test image (R2), trigger *Forgot password* (Resend), load `akavish.gg`.
- Review: Neon monitoring, the R2 object list, Resend's **Emails** log, the
  GitHub security log and deploy keys for `SachsA/Akavish`, the Sentry audit log.
- Note the date here so the next rotation knows how old each key is.

**Rotation log**

- **October 2026** — full rotation of every Railway secret (Railway incident):
  `DATABASE_URL`, `PAYLOAD_SECRET`, R2 keys, `RESEND_API_KEY`,
  `SENTRY_AUTH_TOKEN`. Vercel-only secrets (Clerk) were not exposed and not rotated.

---

## 9. Database backups

`.github/workflows/backup.yml` runs `pg_dump` against the **production** Neon
database every night (03:17 UTC) and uploads a compressed dump to a **private**
R2 bucket. It can also be run by hand: GitHub → **Actions → Database backup →
Run workflow** — worth doing before anything risky (a migration, a bulk delete).

Neon's built-in history is short on the free plan; these dumps are what lets you
recover from a mistake noticed days later.

### One-time setup

> **Status:** done on 2026-11-05. Bucket `akavish-backups`, 30-day rule on `db/`,
> the 5 `BACKUP_*` secrets set; the first manual run succeeded. Restore rehearsed
> on 2026-11-06 with the drill below: all 4 migrations present, `migrate:status`
> clean, row counts matching prod. healthchecks.io check (step 8) added the same
> day and confirmed by a manual run. On 2026-11-07 it caught GitHub starting the
> nightly cron **hours late** (the 03:17 run of the 6th started at 11:00 UTC),
> hence the Cloudflare Worker trigger in step 9, set up and tested the same day
> (its cron started a backup at 09:45:20 UTC, 20 seconds after the minute).

1. **A separate, private bucket.** Cloudflare → R2 → **Create bucket** →
   `akavish-backups`. Do **not** enable public access, and never reuse the media
   bucket: it's public (`media.akavish.gg`), so a dump there would publish the database.
2. **Retention.** In that bucket → **Settings → Object lifecycle rules** → delete
   objects under prefix `db/` after **30 days**. Without it dumps pile up forever.
3. **A dedicated R2 token.** R2 → Manage API tokens → *Object Read & Write*,
   scoped to `akavish-backups` only. Not the CMS's token: if one leaks, the other
   bucket stays safe.
4. **A connection string for the dump.** Neon → prod project → **Connect** →
   untick *Connection pooling* to get the **direct** string (no `-pooler` in the
   host). Optionally use a read-only role so the GitHub secret can't modify data:
   ```sql
   CREATE ROLE backup_ro WITH LOGIN PASSWORD '<generated>';
   GRANT pg_read_all_data TO backup_ro;
   ```
   If Neon refuses the grant on your plan, fall back to the owner role.
5. **Repository secrets.** GitHub → repo → Settings → Secrets and variables →
   Actions:

   | Secret | Value |
   | --- | --- |
   | `BACKUP_DATABASE_URL` | the direct prod connection string from step 4 |
   | `BACKUP_R2_ACCESS_KEY_ID` | from step 3 |
   | `BACKUP_R2_SECRET_ACCESS_KEY` | from step 3 |
   | `BACKUP_R2_ENDPOINT` | `https://<accountId>.r2.cloudflarestorage.com` |
   | `BACKUP_R2_BUCKET` | `akavish-backups` |
   | `BACKUP_HEALTHCHECK_URL` | optional, step 8 |

6. **Check the Postgres version.** The Neon console shows it. If it isn't 17,
   change `PG_MAJOR` in the workflow — `pg_dump` refuses to dump a newer server.
7. Run the workflow once by hand and confirm the file appears in the bucket.
8. **Dead-man's switch (healthchecks.io).** GitHub emails when the job *fails*,
   but nothing tells you when it never *starts* (a skipped cron, a workflow
   disabled after 60 days). Sign up at healthchecks.io (free), **Add Check**:
   name `Akavish DB backup`, schedule **Cron** `17 3 * * *`, time zone **UTC**,
   grace time **3 hours** (GitHub often starts crons late). Copy its ping URL
   (`https://hc-ping.com/<uuid>`) into a sixth repository secret,
   `BACKUP_HEALTHCHECK_URL`. The workflow pings it after each successful upload
   and pings `/fail` when a run fails; no ping by ~06:17 UTC → email. Optional:
   unset, those steps do nothing. Run the workflow once by hand: the check
   turns green ("up").
9. **On-time trigger (Cloudflare Worker).** GitHub's own cron can start hours
   late, which also fires the healthchecks alert. `infra/backup-trigger/`
   holds a Worker whose Cloudflare cron (03:17 UTC, on time) calls GitHub's
   "Run workflow" API. The GitHub cron stays as a fallback; a late second run
   just makes one more dump.
   1. **A dedicated GitHub token.** GitHub → Settings → Developer settings →
      Fine-grained tokens → Generate: name `akavish-backup-trigger`,
      **Only select repositories** → `Akavish`, **Repository
      permissions → Actions: Read and write** (Metadata: read is added
      automatically). Nothing else. The current token was created without an
      expiry date. If it's ever revoked or replaced, the dispatch fails and
      pings healthchecks `/fail`: update the `GITHUB_TOKEN` secret.
   2. **Create the Worker.** Cloudflare → Workers & Pages → **Create** →
      Start with Hello World → name `akavish-backup-trigger` → Deploy →
      **Edit code**, replace everything with `infra/backup-trigger/worker.js`
      → Deploy.
   3. **Secrets.** Worker → Settings → Variables and Secrets → **Add**, type
      *Secret*: `GITHUB_TOKEN` (the token above) and `HC_PING_URL` (the
      healthchecks ping URL, so a failed dispatch emails you at once).
   4. **Schedule.** Worker → Settings → Trigger events → **Add** → Cron
      Triggers → `17 3 * * *` (UTC).
   5. **Test.** The schedule's page has a *Trigger scheduled event* button (or
      wait for the night): a new "Database backup" run appears in GitHub
      Actions within seconds, then the healthchecks check stays green.

   With the CLI instead: `cd infra/backup-trigger && npx wrangler deploy`, then
   `npx wrangler secret put GITHUB_TOKEN` and `… HC_PING_URL`
   (`wrangler.toml` already declares the cron).

### Restoring

**Download** the dump from Cloudflare → R2 → `akavish-backups` → `db/` → the file
→ **Download**. The dashboard flattens the folder into the name, so it lands as
`~/Downloads/db_akavish-<date>.dump` (note the `db_` prefix).

**Drill: check a dump without touching anything.** Restore into a throwaway
`akavish_restore` database in the local Docker Postgres (your seeded `akavish`
DB is left alone), check it, drop it. Worth repeating every few months.

```bash
docker compose up -d
docker exec akavish-postgres createdb -U akavish akavish_restore
docker exec -i akavish-postgres pg_restore --no-owner --no-privileges -U akavish \
  -d akavish_restore < ~/Downloads/db_akavish-<date>.dump; echo "exit: $?"

# Every migration in apps/cms/src/migrations should be listed, counts should match prod
docker exec akavish-postgres psql -U akavish -d akavish_restore \
  -c "select name from payload_migrations order by name;" \
  -c "select (select count(*) from users) users, (select count(*) from articles) articles, (select count(*) from authors) authors, (select count(*) from media) media;"

# Payload must see every migration as applied ("Ran: Yes")
cd apps/cms && DATABASE_URL=postgresql://akavish:akavish@localhost:5432/akavish_restore pnpm migrate:status; cd ../..

# Clean up: the dump holds prod emails and password hashes
docker exec akavish-postgres dropdb -U akavish akavish_restore
rm ~/Downloads/db_akavish-<date>.dump
```

`exit: 0` from `pg_restore` means a clean restore; a lone `schema "public"
already exists` error is harmless. The `postgres:17` container provides
`pg_restore`, so nothing needs installing on the Mac.

**Real restore into prod** (only after the drill above passed on that same
file). `--clean` drops existing objects first, so this **replaces** the target:

```bash
docker exec -i akavish-postgres pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "<direct prod connection string>" < ~/Downloads/db_akavish-<date>.dump
```

Use the **direct** Neon string (no `-pooler`), the same kind as
`BACKUP_DATABASE_URL`. Take a fresh manual backup first (Actions → Database
backup → Run workflow) so the current state can be recovered if the restore was
the mistake.

Media files are **not** in the dump — they live in the R2 media bucket.

### Things that can silently stop it

All of these are caught by the healthchecks.io check (step 8): no ping by
~06:17 UTC means an email, whatever the cause.

- **GitHub starts scheduled runs late**, by hours on this repo. The Worker
  (step 9) is what makes the backup punctual; if it ever stops (revoked
  token, Worker deleted), healthchecks emails you the same morning.
- **GitHub disables scheduled workflows after 60 days without repository
  activity.** If you step away from the project, check Actions when you return
  and re-enable it. You also get an email.
- A failed run emails whoever last edited the workflow's schedule — don't filter
  those out.
- Rotating the prod database password (§8) means updating
  `BACKUP_DATABASE_URL` too.

---

## 10. Running in Docker

Production doesn't use containers: Vercel and Railway build from the repo.
`apps/web/Dockerfile` and `apps/cms/Dockerfile` are the **exit door**, ready if
either platform ever has to be replaced by a VPS, Fly.io, Render's Docker mode
or anything else that runs an image. Both were built and run end to end on
2026-11-06 (pages served, migrations applied, an image upload resized by
`sharp`).

How they work: built from the **repo root** (the lockfile and workspace
packages live there); `turbo prune` keeps only the app and what it depends on;
the build sets `NEXT_OUTPUT=standalone`, which makes `next.config.ts` emit
Next's self-contained server. That variable is set **only** in the
Dockerfiles, so Vercel and Railway builds are unchanged. Runtime images run as
a non-root user, about 400 MB each.

```bash
# CMS: migrations first (what Railway's pre-deploy does), then the server
docker build -f apps/cms/Dockerfile --target migrate -t akavish-cms-migrate .
docker build -f apps/cms/Dockerfile -t akavish-cms .
docker run --rm -e DATABASE_URL=... -e PAYLOAD_SECRET=... akavish-cms-migrate
docker run -p 3001:3001 --env-file cms.env akavish-cms

# Web: NEXT_PUBLIC_* are baked in at build time, so they're build args
docker build -f apps/web/Dockerfile -t akavish-web \
  --build-arg NEXT_PUBLIC_SITE_URL=https://akavish.gg \
  --build-arg NEXT_PUBLIC_APP_URL=https://akavish.gg \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... \
  --build-arg NEXT_PUBLIC_SENTRY_DSN=https://... \
  --build-arg CMS_URL=https://cms.akavish.gg .
docker run -p 3000:3000 --env-file web.env akavish-web
```

`cms.env` / `web.env` hold the **runtime** variables from the reference below
(CMS: `DATABASE_URL`, `PAYLOAD_SECRET`, `SERVER_URL`, `WEB_URL`, `R2_*`,
`RESEND_API_KEY`, `SENTRY_DSN`…; web: `CLERK_SECRET_KEY`, `CMS_URL`,
`MEILISEARCH_*`…). Never bake secrets into an image with `--build-arg`: only
the public `NEXT_PUBLIC_*` values belong there.

Two things that differ from the platforms:

- **Media must be on R2.** A container's disk is thrown away on restart, so
  with `R2_BUCKET` unset, uploads vanish (§4b).
- **Source maps:** to upload them to Sentry, pass `SENTRY_ORG`,
  `SENTRY_PROJECT(_CMS)` and `SENTRY_AUTH_TOKEN` as build args too, or traces
  stay minified. The token then sits in the build cache, so build on a trusted
  machine.

---

## 11. AI scout

The scout (`apps/cms/src/scout/`, design doc linked in `PROGRESS.md`) runs
inside the CMS as the `scoutTick` job, every 5 minutes, in its own `scout`
queue. It is **off** until `SCOUT_ENABLED=true`. Step 1 observes: it collects
38 RSS feeds, groups items into stories with Claude Haiku, scores them, and
posts a digest to Discord at 8 am and 8 pm (Paris time). Step 2 writes: a story
above the threshold becomes a **draft** article (Claude Sonnet), sent to Discord
with Publish / Edit / Reject buttons. Nothing goes live without your click.
Automatic drafts are **off** until you tick *Scout settings → draftsEnabled*.

**Set it up (once):**

1. **Anthropic API key.** [platform.claude.com](https://platform.claude.com) →
   billing: prepaid credit; limits: a **monthly spend limit (50 $)**; API keys:
   create `akavish-scout`. The spend limit is the last safety net if the code's
   own caps ever fail.
2. **Discord webhook.** A private channel (only you) → Edit channel →
   Integrations → Webhooks → New webhook → copy its URL. A webhook URL can only
   post to that channel; if it ever leaks, delete the webhook and create a new one.
3. **Railway → CMS service → Variables:** `ANTHROPIC_API_KEY`,
   `SCOUT_DISCORD_WEBHOOK_URL`, `SCOUT_ENABLED=true`. Redeploy.
4. Within 5 minutes, `/admin` → **Scout** → *Scout sources* fills with the 38
   default feeds and their status (`ok, 12 new`, `HTTP 403`…). The first digest
   comes at the next 8 am or 8 pm.

| Variable | Default | What it does |
| --- | --- | --- |
| `SCOUT_ENABLED` | off | `true` turns the job on. Anything else: the job does nothing. |
| `ANTHROPIC_API_KEY` | — | **Secret.** Unset → dry run (no AI call, each item its own story). |
| `SCOUT_DISCORD_WEBHOOK_URL` | — | **Secret-ish** (lets anyone post to the channel). Unset → digests only logged. |
| `SCOUT_MONTHLY_BUDGET_USD` | `50` | Past it the scout pauses itself and says so on Discord; an 80 % warning first. |
| `SCOUT_DAILY_BUDGET_USD` | `5` | Past it, triage stops until the next UTC day. |
| `SCOUT_TRIAGE_MODEL` | `claude-haiku-5-5` | Model for grouping and scoring. |
| `SCOUT_DRAFT_MODEL` | `claude-sonnet-5-5` | Model for drafts and revisions. |
| `SCOUT_DRY_RUN` | off | `true`: no AI call, no Discord post, everything logged. |
| `DISCORD_BOT_TOKEN` | — | **Secret.** Step 2 bot. The five bot variables go together; any missing → no bot, drafts announced through the webhook without buttons. |
| `DISCORD_APPLICATION_ID` | — | Developer portal → General Information. |
| `DISCORD_PUBLIC_KEY` | — | Same page. Checks that clicks really come from Discord. |
| `SCOUT_DISCORD_CHANNEL_ID` | — | The private channel (Developer Mode → Copy Channel ID). |
| `SCOUT_DISCORD_OWNER_ID` | — | Your user ID: only your clicks count. |

**Step 2, the Discord bot (once).** A webhook can only post; buttons need a
bot. Discord calls the CMS when you click, at `/api/scout/discord`.

1. [discord.com/developers/applications](https://discord.com/developers/applications)
   → *New Application* → `Akavish Scout`. On *General Information*, copy the
   **Application ID** and the **Public Key**.
2. *Bot* → *Reset Token* → copy the **token** (shown once, it's a secret).
   No privileged intent is needed.
3. *OAuth2 → URL Generator*: scope `bot`, permissions *View Channel*, *Send
   Messages*, *Embed Links*, *Read Message History*. Open the URL, add the bot
   to the Akavish server. In the private channel's permissions, add the bot.
4. Discord → Settings → Advanced → **Developer Mode** on. Right-click the
   channel → *Copy Channel ID*; right-click yourself → *Copy User ID*.
5. **Railway → CMS → Variables:** `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`,
   `DISCORD_PUBLIC_KEY`, `SCOUT_DISCORD_CHANNEL_ID`, `SCOUT_DISCORD_OWNER_ID`.
   Redeploy.
6. **After** that deploy: back in the developer portal → *General Information* →
   **Interactions Endpoint URL** = `https://cms.akavish.gg/api/scout/discord` →
   Save. Discord pings the URL and only saves it if the CMS answers with the
   right signature, so a save that fails means a variable is wrong (usually
   the public key) or the deploy isn't live yet.
7. `/admin` → *Scout settings*: pick the **default author** of drafts (else the
   first author, else an "Akavish Newsroom" author is created).

From then on, digests come from the bot and end with a **"Rédiger…"** menu:
pick a story and its draft arrives within a minute or two. That works even
with `draftsEnabled` off, so you can test drafts one at a time.

**How a draft works.** The scout reads up to 6 sources (official first, the
pages themselves for the first 4, same honest User-Agent), asks Sonnet for a
150-300 word article in English with a *Sources* list at the end, and saves it
as a **draft** article with `aiAssisted` ticked (the site then shows a one-line
note under it, see `/terms`).

**Media.** Every article needs a cover, so the scout picks one: the share image
(`og:image`) of an **official** source (publisher, studio, platform, tournament
organiser), else the cover of the story's game in *Games*. Never a press
outlet's image: their photos aren't ours to reuse. YouTube videos embedded or
linked in the sources are looked up (title and channel, YouTube oEmbed, no
key); Sonnet keeps the official ones about the story and the article links them
in a **Watch** section above *Sources*. The Discord card shows the cover, where
it came from, and the videos; with no image it says so in orange. On Discord:

- **Publier**: the article goes live, the message shows its URL. Refused,
  privately, while the article has no cover.
- **Modifier**: a form with two optional boxes, what's wrong and an **image
  URL** (official visual, https). Text → V2 rewritten as a reply, with the same
  buttons; image only → the cover changes, text untouched, no AI call. Revise as
  many times as needed.
- **Rejeter**: optional reason; the draft article is deleted.
- **Ouvrir dans /admin**: edit it by hand, then publish from `/admin` or the
  button.

Only `SCOUT_DISCORD_OWNER_ID` can click; anyone else gets a private refusal.
Automatic drafts (`draftsEnabled`): at most 3 per run and `maxDraftsPerDay`
(20) a day, only stories at or above the threshold, under 24 h old, not drafted
yet. A draft costs about 0.05-0.10 $ with Sonnet.

**Day to day:** pause or resume with *Scout settings → paused* in `/admin`
(the scout ticks it itself when the monthly budget is spent); move the draft
threshold there too (60 by default). Spending: *Scout usage*, one row per
call. Mute a feed: untick *active* on it. Logs: Railway, lines starting with
`[scout]`. **Weekly report:** posted on Discord with the first digest every
Saturday; the full version any time at
`https://cms.akavish.gg/api/scout/report?days=7`, in a browser logged into
`/admin` (stories per day, how many would pass at each threshold, drafts,
cost, silent or failing feeds).

**Feeds that refuse the scout.** It always says who it is
(`AkavishScout/1.0 (+https://akavish.gg)`). A feed that answers 403 shows it in
its status: untick it, and never switch to a browser User-Agent to get through.
The dev sandbox got 403s that curl, with the same User-Agent, didn't, so only
production tells: on 2026-11-10 all 38 were `ok` or `not modified` in
production. Re-check when you add a feed.

---

## Environment variable reference

**Web (Vercel)**

| Var                                 | Example                   | Notes                     |
| ----------------------------------- | ------------------------- | ------------------------- |
| `CMS_URL`                           | `https://cms.akavish.gg`  | Server-side fetch target  |
| `NEXT_PUBLIC_SITE_URL`              | `https://akavish.gg`      | Canonical/SEO base        |
| `NEXT_PUBLIC_APP_URL`               | `https://akavish.gg`      |                           |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` / `pk_test_…` | Live on Production, test on Preview — §6.5 |
| `CLERK_SECRET_KEY`                  | `sk_live_…` / `sk_test_…` | Live on Production, test on Preview — §6.5 |
| `MEILISEARCH_HOST`                  | `https://…meilisearch.io` | Optional                  |
| `MEILISEARCH_SEARCH_KEY`            | `…`                       | Optional, search-only key |
| `NEXT_PUBLIC_SENTRY_DSN`            | `https://…ingest.sentry.io/…` | Unset → Sentry off (§4d) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT`    | `production`              | Optional, defaults to `NODE_ENV` |
| `SENTRY_ORG` / `SENTRY_PROJECT`     | `…`                       | Build-time, source maps   |
| `SENTRY_AUTH_TOKEN`                 | `sntrys_…`                | **Secret**, build-time only |
| `REVALIDATE_SECRET`                 | `openssl rand -hex 32`    | **Secret**, same as the CMS's; unset → `/api/revalidate` off (§4e) |

**CMS (Railway/Render)**

| Var                   | Example                          | Notes                               |
| --------------------- | -------------------------------- | ----------------------------------- |
| `DATABASE_URL`        | `postgresql://…?sslmode=require` | Prod Neon                           |
| `PAYLOAD_SECRET`      | long random string               | Generate fresh for prod             |
| `SERVER_URL`          | `https://cms.akavish.gg`         | The CMS's own public URL            |
| `WEB_URL`             | `https://akavish.gg`             | Allowed CORS/CSRF origin            |
| `MEILISEARCH_HOST`    | `https://…`                      | Optional                            |
| `MEILISEARCH_API_KEY` | master key                       | Optional, write access for indexing |
| `RESEND_API_KEY`      | `re_…`                           | Unset → emails only logged (§4c)    |
| `EMAIL_FROM_ADDRESS`  | `noreply@mail.akavish.gg`        | Must be on a Resend-verified domain |
| `EMAIL_FROM_NAME`     | `Akavish`                        | Display name on outgoing mail       |
| `R2_BUCKET`           | `akavish-media`                  | Unset → local disk (§4b)            |
| `R2_ACCESS_KEY_ID`    | `…`                              | R2 API token                        |
| `R2_SECRET_ACCESS_KEY`| `…`                              | R2 API token                        |
| `R2_ENDPOINT`         | `https://<accountId>.r2.cloudflarestorage.com` | Uploads only          |
| `R2_PUBLIC_URL`       | `https://media.akavish.gg`       | Serves the files                    |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | — | **Local `.env` only**, never on Railway: `pnpm seed` refuses non-localhost databases |
| `SENTRY_DSN`          | `https://…ingest.sentry.io/…`    | Unset → Sentry off (§4d). Not `NEXT_PUBLIC_` |
| `SENTRY_ENVIRONMENT`  | `production`                     | Optional, defaults to `NODE_ENV`    |
| `SENTRY_ORG` / `SENTRY_PROJECT_CMS` | `…`                | Build-time, source maps             |
| `SENTRY_AUTH_TOKEN`   | `sntrys_…`                       | **Secret**, build-time only         |
| `SCOUT_ENABLED`       | `true`                           | AI scout on; unset → off (§11)      |
| `ANTHROPIC_API_KEY`   | `sk-ant-…`                       | **Secret**, AI scout (§11)          |
| `SCOUT_DISCORD_WEBHOOK_URL` | `https://discord.com/api/webhooks/…` | AI scout digests (§11) |
| `SCOUT_MONTHLY_BUDGET_USD` / `SCOUT_DAILY_BUDGET_USD` | `50` / `5` | Optional caps (§11) |
| `DISCORD_BOT_TOKEN`   | `…`                              | **Secret**, scout bot (§11)         |
| `DISCORD_APPLICATION_ID` / `DISCORD_PUBLIC_KEY` | `…` | Scout bot, developer portal (§11) |
| `SCOUT_DISCORD_CHANNEL_ID` / `SCOUT_DISCORD_OWNER_ID` | `…` | Scout bot channel and the only allowed clicker (§11) |
| `REVALIDATE_SECRET`   | same as the web's                | **Secret**, pings the site after a change (§4e) |

---

## Recap

1. Prod Postgres (Neon).
2. `pnpm migrate:create initial` + commit.
3. CMS on Railway/Render (repo root), env set, `pnpm migrate`, create admin.
4. Web on Vercel (root `apps/web`), Clerk keys + `CMS_URL` + `NEXT_PUBLIC_SITE_URL`.
5. R2 for media (§4b) + Resend for email (§4c) — both required in prod.
6. (Optional) Meilisearch + `reindex:search`.
7. Domains + DNS, then update URLs and redeploy.
8. Nightly database backups to a private R2 bucket (§9) + UptimeRobot probes (§4d).
   (Docker images for both apps exist as a fallback host option: §10.)
9. Walk the post-deploy checklist.
