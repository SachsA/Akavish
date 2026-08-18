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
| **Search**           | Meilisearch         | **Meilisearch Cloud** or self-hosted (Docker on the same VPS/Railway) | Optional at launch — the site works without it, search just reports unavailable.                                                                       |
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

> **Migrations:** both the dev and prod databases use the committed migration
> history. Payload runs with `push: false`, so it never changes a schema on boot.
> Before a brand-new database can serve the CMS, run the committed migrations as
> described in [§5](#5-database-schema-how-tables-get-created-read-this).

---

## Day-to-day workflow (dev → prod)

Once deployed, this is the loop for everyday changes.

### Develop locally

Everything runs on your machine, against the **dev** database — production is
never touched.

```bash
# Terminal 1 — CMS on :3001 (uses apps/cms/.env → DEV Neon DB)
cd apps/cms && pnpm devsafe
# Terminal 2 — web on :3000 (uses apps/web/.env → talks to local CMS)
cd apps/web && pnpm dev
```

|                           | Database it uses | Config source                             |
| ------------------------- | ---------------- | ----------------------------------------- |
| **Local** (`pnpm dev`)    | **dev** Neon DB  | your local `.env` files (gitignored)      |
| **Live** (Railway/Vercel) | **prod** Neon DB | env vars set in each platform's dashboard |

Content you create locally lands in the dev DB; prod content is separate. On a
brand-new dev DB, run `pnpm migrate` once before starting the CMS, then add test
data.

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

> Clerk keys: **production** (`pk_live_…` / `sk_live_…`) is the end state, but a
> development instance does work on a custom domain and Akavish deliberately
> still runs on `pk_test_…` — see §6.5 for the reasoning and the switch steps.

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
   bucket → **Settings** → either enable the **r2.dev subdomain** (quick, gives
   `https://<hash>.r2.dev`) or connect a **custom domain** (e.g.
   `media.akavish.gg`). This public URL is what serves the images.
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
R2_PUBLIC_URL=https://<hash>.r2.dev                        # serves the files
```

On the **web** (Vercel), so `next/image` is allowed to load from that host:

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://<hash>.r2.dev
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

> Sends fail with a 4xx from Resend if `EMAIL_FROM_ADDRESS` isn't on a verified
> domain — Payload surfaces it as an `APIError` in the CMS logs (§ "Where to read
> production errors"). Until the domain is verified, Resend only accepts sends to
> your own account address, so test with that.

---

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

---

## 6. Domains & DNS

Setup: domain registered at **Porkbun**, DNS managed by **Cloudflare** (registrar
nameservers point to Cloudflare). Target layout:

| Hostname               | Points to     | Purpose                    |
| ---------------------- | ------------- | -------------------------- |
| `akavish.gg` (+ `www`) | Vercel        | Public site                |
| `cms.akavish.gg`       | Railway       | CMS admin + API            |
| `media.akavish.gg`     | Cloudflare R2 | Media CDN (optional, later) |

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

### 6.5 Clerk — staying on the development instance (current choice)

The site currently runs with Clerk **development** keys (`pk_test_…`), on purpose:
creating a production instance was gated behind a paid plan, and reader accounts
aren't used for anything yet (no comments, no favourites). Development instances
do work on a custom domain, with caveats — a "development mode" banner, lower
limits, and sessions not meant for real users.

Move to a production instance when readers actually need accounts:

1. Clerk dashboard → **Create production instance**.
2. Add the DNS records Clerk provides (CNAMEs like `clerk.akavish.gg`) in Cloudflare.
3. Replace the keys on Vercel with `pk_live_…` / `sk_live_…`, redeploy.

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
- [ ] Published a test article → it appears on `https://akavish.gg`.
- [ ] `https://akavish.gg/sitemap.xml` and `/robots.txt` return prod URLs.
- [ ] Sign-up/login works on the live domain. Clerk currently runs on
      **development** keys by choice (§6.5) — switch to `pk_live_…` when reader
      accounts start to matter.
- [ ] CORS: the CMS `WEB_URL` matches the live web origin (else the browser
      blocks client calls — server-side fetches are unaffected).
- [ ] Search backfilled (if enabled) and the header search returns results.
- [ ] `RESEND_API_KEY` set on the CMS and **"Forgot password" actually delivers a
      mail** (§4c). Without it Payload silently logs emails to the console and a
      lost admin password is unrecoverable.

---

## Environment variable reference

**Web (Vercel)**

| Var                                 | Example                   | Notes                     |
| ----------------------------------- | ------------------------- | ------------------------- |
| `CMS_URL`                           | `https://cms.akavish.gg`  | Server-side fetch target  |
| `NEXT_PUBLIC_SITE_URL`              | `https://akavish.gg`      | Canonical/SEO base        |
| `NEXT_PUBLIC_APP_URL`               | `https://akavish.gg`      |                           |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…` | Currently the dev key — §6.5 |
| `CLERK_SECRET_KEY`                  | `sk_test_…` / `sk_live_…` | Currently the dev key — §6.5 |
| `MEILISEARCH_HOST`                  | `https://…meilisearch.io` | Optional                  |
| `MEILISEARCH_SEARCH_KEY`            | `…`                       | Optional, search-only key |

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
| `R2_PUBLIC_URL`       | `https://<hash>.r2.dev`          | Serves the files                    |

---

## Recap

1. Prod Postgres (Neon).
2. `pnpm migrate:create initial` + commit.
3. CMS on Railway/Render (repo root), env set, `pnpm migrate`, create admin.
4. Web on Vercel (root `apps/web`), Clerk keys + `CMS_URL` + `NEXT_PUBLIC_SITE_URL`.
5. R2 for media (§4b) + Resend for email (§4c) — both required in prod.
6. (Optional) Meilisearch + `reindex:search`.
7. Domains + DNS, then update URLs and redeploy.
8. Walk the post-deploy checklist.
