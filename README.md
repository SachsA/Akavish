# Akavish (AKV)

> Breaking gaming news, exclusive leaks, in-depth reviews. Fast. Serious. No fluff.

![CI](https://github.com/SachsA/akavish/actions/workflows/ci.yml/badge.svg)

## Stack

| Layer    | Tech                                                                |
| -------- | ------------------------------------------------------------------- |
| Web      | Next.js 15 (App Router) + TypeScript + Tailwind — runs on **:3000** |
| CMS      | Payload 3 (standalone Next.js app) — runs on **:3001**              |
| Mobile   | React Native + Expo + expo-router                                   |
| Database | PostgreSQL (Neon/Supabase)                                          |
| Auth     | Clerk (readers, web + mobile) · Payload auth (CMS editors)          |
| Search   | Meilisearch                                                         |
| Storage  | Cloudflare R2                                                       |
| Email    | Resend (sending) · Cloudflare Email Routing (receiving)             |
| Hosting  | Vercel (web) + Expo EAS (mobile)                                    |
| Monorepo | Turborepo + pnpm workspaces                                         |

## Structure

```
akavish/
├── apps/
│   ├── web/          # Next.js frontend (:3000) — pages + API routes that proxy the CMS
│   ├── cms/          # Standalone Payload CMS (:3001) — admin + REST/GraphQL API
│   └── mobile/       # Expo — iOS & Android
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── api-client/   # Shared API client (web & mobile consume same backend)
│   └── ui/           # Shared React components
├── scripts/          # Repo-level shell scripts (clean)
├── docker-compose.yml # Local Meilisearch
├── turbo.json
├── pnpm-workspace.yaml # Workspaces + pnpm overrides (single source — no nested copies)
└── tsconfig.base.json
```

Conventions: **one lockfile** (`pnpm-lock.yaml` at the root — npm/yarn and nested
lockfiles are gitignored), **one Prettier config** (root `.prettierrc`), and every
workspace exposes a `type-check` script so CI covers apps _and_ shared packages.

### How the pieces talk

The **CMS** (Payload, port 3001) owns the content and the database. It exposes a
REST API at `http://localhost:3001/api`. The **web** app (port 3000) is a thin
frontend: its server components fetch published articles from the CMS via
`CMS_URL` and render them. The **mobile** app hits the same CMS API. Reader auth
(login/signup) is handled by **Clerk** on the web; CMS editors log into Payload
admin separately.

## Getting started

### Prerequisites

**Required**

- **Node 20 or 22 LTS** — a `.nvmrc` pins 22, so `nvm use` is enough.
  Avoid Node 25+: Payload/Next can run out of heap memory on it.
  No nvm? Install Node 22 directly: `brew install node@22` (macOS) then
  `brew link --overwrite --force node@22`.
- **pnpm 9 or newer** (10 works) — `corepack enable` (ships with Node) or
  `npm i -g pnpm`.
- **PostgreSQL database** — a connection string for `DATABASE_URL`. Easiest is a
  free [Neon](https://neon.tech) or [Supabase](https://supabase.com) project; a
  local Postgres works too.
- **Docker** _(for search)_ — runs a local Meilisearch (`docker compose up -d`).

> `pnpm reset:db` needs no extra tooling — it uses the `pg` driver bundled with
> the CMS (no `psql` required).

**External accounts you'll need (free tiers are fine to start)**

- **Clerk** — for reader login/signup. Create an app at
  [clerk.com](https://clerk.com), grab the publishable + secret keys.
- **Meilisearch** — search. Integrated; run it locally with Docker (free,
  self-hosted). Only the managed _Meilisearch Cloud_ is paid.
- **Cloudflare R2** — media storage for uploads (required in production; the CMS
  host's disk is ephemeral). See [`DEPLOYMENT.md` §4b](./DEPLOYMENT.md). Leave
  `R2_BUCKET` unset locally to keep using local disk.
- **Resend** — transactional email from the CMS (password resets). Required in
  production, see [`DEPLOYMENT.md` §4c](./DEPLOYMENT.md). Leave `RESEND_API_KEY`
  unset locally and Payload just prints emails to the terminal.

**Recommended tooling**

- Git, and a code editor (VS Code config lives in `apps/cms/.vscode`).
- `brew` (macOS) for installing the above.

### Install

```bash
pnpm install
```

### Environment variables

Copy the example files and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/cms/.env.example apps/cms/.env
cp apps/mobile/.env.example apps/mobile/.env
```

At minimum you need: `DATABASE_URL` + `PAYLOAD_SECRET` (CMS), and the Clerk keys

- `CMS_URL` (web). For correct SEO URLs in production, also set
  `NEXT_PUBLIC_SITE_URL` (e.g. `https://akavish.gg`) on the web app.

### Dev

The CMS and the web app are **separate processes on different ports**. Run them
in two terminals:

```bash
# Terminal 1 — CMS (Payload admin + API) on http://localhost:3001
cd apps/cms && pnpm devsafe

# Terminal 2 — web frontend on http://localhost:3000
cd apps/web && pnpm dev
```

- Public site: <http://localhost:3000>
- CMS admin: <http://localhost:3001/admin>

> Articles only appear on the site once their **status is `Published`** in the
> CMS. Drafts are visible to logged-in editors only.

#### Search (Meilisearch)

Site search is powered by Meilisearch. Start it with Docker, then point both
apps at it (the keys are already stubbed in the `.env.example` files):

```bash
# From the repo root — starts Meilisearch on http://localhost:7700
docker compose up -d

# Backfill the index with existing published articles (run once)
cd apps/cms && pnpm reindex:search
```

After that, publishing/editing an article in the CMS keeps the index in sync
**automatically** (Payload hooks) — no manual step in normal use. The web app
searches via `/api/search` and the header search box / `/search` page. If
`MEILISEARCH_HOST` is unset, indexing is skipped and search reports as
unavailable — the rest of the site works normally.

`pnpm reindex:search` is only a one-off catch-up: first setup, after a DB/index
wipe (`pnpm reset:db`), or to repair a desync if Meilisearch was down during a
publish. See `apps/cms/README.md` for details.

Mobile (optional):

```bash
cd apps/mobile && pnpm dev
```

### Resetting

Two independent tools:

```bash
# Build/deps clean — wipes node_modules, .next, .turbo, .expo, dist, *.tsbuildinfo.
# Leaves .env files and the database untouched.
pnpm clean
pnpm install          # then reinstall and you're back to a clean env

# Database reset — DESTRUCTIVE. Drops all data (articles, users, media…).
# No psql needed (uses the pg driver). Asks you to type "reset" to confirm.
pnpm reset:db                 # wipes the DEV db (DATABASE_URL from apps/cms/.env)
pnpm reset:db "<DATABASE_URL>"  # wipes a specific db, e.g. production
pnpm reset:db --yes           # skip the confirmation prompt
```

After a DB reset the schema is gone, so re-apply migrations to rebuild the tables:
`cd apps/cms && pnpm migrate` (add `DATABASE_URL='<url>'` inline to target prod).
Then open `/admin` to create a fresh first admin user. See `DEPLOYMENT.md` §5.

> `reset:db` only touches the database. Run `pnpm clean` separately if you also
> want to wipe build artifacts.

## CI

GitHub Actions runs on every push to `main` and every pull request
(`.github/workflows/ci.yml`):

- **Lint & type-check** — lint runs on web + CMS; type-check runs on web, CMS,
  and shared packages. Mobile is excluded for now: it's on Expo 52 / React 18
  while the rest is React 19 (see `PROGRESS.md`).
- **Build** — `pnpm build` (web + CMS) against a throwaway Postgres service with
  dummy env values; Meilisearch is left unset and degrades gracefully.

Run the same checks locally before pushing:

```bash
pnpm lint && pnpm type-check && pnpm build
```

Both apps lint via ESLint flat config (`eslint.config.mjs`) using
`eslint-config-next`'s native flat presets — no `next lint`, no FlatCompat.

> The build job uses `pnpm install --frozen-lockfile`, so commit an up-to-date
> `pnpm-lock.yaml` whenever you change dependencies.

## Deployment

Going to production? Follow **[DEPLOYMENT.md](./DEPLOYMENT.md)** — a step-by-step
runbook (web → Vercel, CMS → Railway/Render, Postgres → Neon, migrations,
search, domains, and a post-deploy checklist).

## Project status & roadmap

There is **one** source of truth for what's built, in progress, and still to do:

### 👉 [PROGRESS.md](./PROGRESS.md)

It lists everything done (grouped by area) and the full prioritized backlog
(pages, back-office, deployment, legal, mobile…). Keep it updated as work lands —
this README only covers _what the project is and how to run it_, not status.

## Contributing / working agreement

[`CLAUDE.md`](./CLAUDE.md) and [`AGENTS.md`](./AGENTS.md) at the repo root hold
the standing conventions for AI-assisted changes: keep all docs/config in sync,
distinguish a DB-migration push from a normal push, and finish with an exact
commit command. The two files are **mirrors** (one per assistant) — edit one,
edit the other.
