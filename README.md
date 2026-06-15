# Akavish (AKV)

> Breaking gaming news, exclusive leaks, in-depth reviews. Fast. Serious. No fluff.

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 15 (App Router) + TypeScript + Tailwind — runs on **:3000** |
| CMS | Payload 3 (standalone Next.js app) — runs on **:3001** |
| Mobile | React Native + Expo + expo-router |
| Database | PostgreSQL (Neon/Supabase) |
| Auth | Clerk (readers, web + mobile) · Payload auth (CMS editors) |
| Search | Meilisearch |
| Storage | Cloudflare R2 |
| Hosting | Vercel (web) + Expo EAS (mobile) |
| Monorepo | Turborepo + pnpm workspaces |

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
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

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
- **pnpm 9** — `corepack enable` (ships with Node) or `npm i -g pnpm`.
- **PostgreSQL database** — a connection string for `DATABASE_URL`. Easiest is a
  free [Neon](https://neon.tech) or [Supabase](https://supabase.com) project; a
  local Postgres works too.

**Required only for `pnpm reset:db`**

- **psql** (PostgreSQL client) — macOS: `brew install libpq` then
  `brew link --force libpq` (or `brew install postgresql@16`). The reset script
  uses it to drop/recreate the schema.

**External accounts you'll need (free tiers are fine to start)**

- **Clerk** — for reader login/signup. Create an app at
  [clerk.com](https://clerk.com), grab the publishable + secret keys.
- **Cloudflare R2** *(later)* — media storage. Stubbed in `.env`, not wired yet.
- **Meilisearch** *(later)* — search. Not integrated yet.

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
cp apps/web/.env.example apps/web/.env.local
cp apps/cms/.env.example apps/cms/.env
cp apps/mobile/.env.example apps/mobile/.env.local
```

At minimum you need: `DATABASE_URL` + `PAYLOAD_SECRET` (CMS), and the Clerk keys
+ `CMS_URL` (web).

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
- CMS admin:   <http://localhost:3001/admin>

> Articles only appear on the site once their **status is `Published`** in the
> CMS. Drafts are visible to logged-in editors only.

Mobile (optional):

```bash
cd apps/mobile && pnpm dev
```

### Resetting

```bash
# Full clean — wipes node_modules, .next, .turbo, .expo, dist, *.tsbuildinfo.
# Leaves .env files and the database untouched.
pnpm clean
pnpm install          # then reinstall and you're back to a clean env

# Nuclear — DESTRUCTIVE. Also drops the Payload database (all content/users),
# then runs the full clean. Asks for confirmation (or pass --yes).
pnpm reset:db
```

After `pnpm reset:db`, the CMS rebuilds its tables on the next `pnpm devsafe`
(Payload runs in push mode), and you'll create a fresh admin user on first load.
Requires the `psql` client installed locally.

## Roadmap

- [x] Monorepo setup (Turborepo + pnpm)
- [x] Next.js web app with shared API routes
- [x] Expo mobile app consuming same API
- [x] Shared types & API client packages
- [x] Payload CMS integration (standalone on :3001, REST API consumed by web)
- [x] Web frontend wired to CMS (home feed + article detail page)
- [x] Prisma + PostgreSQL schema (articles, games, authors)
- [x] Clerk auth (reader login/signup on web; Payload auth stays for editors)
- [x] Category pages (/news, /leaks, /reviews, /esport, …)
- [x] Author / game / tag pages, with cross-links from articles
- [ ] Meilisearch integration
- [ ] Push notifications (Expo)
- [ ] i18n (EN + FR)

See [PROGRESS.md](./PROGRESS.md) for the detailed, up-to-date task log.
