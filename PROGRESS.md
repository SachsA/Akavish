# Akavish — Progress Log

**The single source of truth for project status.** The README explains _what the
project is and how to run it_; this file tracks _what's done and what's left_.

- **[Done](#done)** — everything built so far, grouped by area.
- **[In progress / next up](#in-progress--next-up)** — what's active right now.
- **[Backlog](#backlog--everything-left-to-do)** — the full prioritized to-do
  list (pages, back-office, deployment, legal, mobile…).

Legend: ✅ done · 🚧 in progress · ⬜ not started ·
priorities **P1** (before launch) / **P2** (soon after) / **P3** (nice-to-have).

Last updated: **2026-07-28**.

---

# Done

## Foundations

| Status | Item                                   | Notes                                                    |
| ------ | -------------------------------------- | -------------------------------------------------------- |
| ✅     | Monorepo (Turborepo + pnpm workspaces) | `apps/web`, `apps/cms`, `apps/mobile`, `packages/*`      |
| ✅     | Shared `types` package                 | `Article`, `Game`, `Author`, pagination, API error types |
| ✅     | Shared `api-client` package            | Talks to the Payload REST API (web + mobile)             |
| ✅     | Shared `ui` package                    | Common React components                                  |
| ✅     | Node version pinned                    | `.nvmrc` → 22 LTS (Node 25+ caused OOM crashes)          |

## CMS (Payload, port 3001)

| Status | Item                          | Notes                                                                                                                 |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ✅     | Payload 3 standalone app      | Admin UI + REST/GraphQL API                                                                                           |
| ✅     | PostgreSQL adapter (Neon)     | Replaced the template's default Mongo config                                                                          |
| ✅     | Collections                   | articles, authors, games, tags, media, users                                                                          |
| ✅     | Article model                 | rich-text (Lexical), category, status, author/game/tags, SEO                                                          |
| ✅     | Drafts + versions on articles | Draft / Published / Archived                                                                                          |
| ✅     | Auto-slugs on all collections | `slugField` (auto from name/title if empty, manual-editable, `-2/-3…` on clash) now on articles, authors, games, tags |
| ✅     | Public read access control    | Articles: published-only for public; editors see all. Authors/games/tags/media: public read                           |
| ✅     | Dev script fixed              | `-p 3001` + `--max-old-space-size=8000` on `dev`/`devsafe`                                                            |
| ✅     | `serverURL` / CORS / CSRF     | serverURL → :3001, CORS/CSRF allow web origin :3000                                                                   |

## Web (Next.js, port 3000)

| Status | Item                                  | Notes                                                                               |
| ------ | ------------------------------------- | ----------------------------------------------------------------------------------- |
| ✅     | Wired to the CMS                      | `src/lib/payload.ts` fetches + maps Payload docs → shared `Article`                 |
| ✅     | `/api/articles` route                 | Proxies published articles from the CMS                                             |
| ✅     | `/api/articles/[slug]` route          | Single published article by slug (Next 15 async `params`)                           |
| ✅     | Home page feed                        | Real published articles, with empty + CMS-unreachable states                        |
| ✅     | `ArticleCard` component               | Cover, category, date, excerpt, author                                              |
| ✅     | Article detail page `/article/[slug]` | Renders Lexical content, SEO metadata, OG tags                                      |
| ✅     | Lexical → React renderer              | `LexicalContent.tsx` (headings, lists, quotes, links, inline formats)               |
| ✅     | Category pages `/[category]`          | news, leaks, reviews, esport, previews, conferences                                 |
| ✅     | Author pages `/author/[slug]`         | Profile (avatar, bio, twitter) + their published articles                           |
| ✅     | Game pages `/game/[slug]`             | Game metadata (cover, platform, genre, dev/publisher) + coverage                    |
| ✅     | Tag pages `/tag/[slug]`               | Articles filtered by tag                                                            |
| ✅     | Cross-links                           | Article byline → author/game; tag chips → tag pages                                 |
| ✅     | Custom 404 / error pages              | `not-found.tsx`, `error.tsx`, `global-error.tsx`                                    |
| ✅     | Functional footer                     | Sections, About/Contact/Legal, RSS, socials — all targets now exist                 |
| ✅     | Footer pages                          | `/about`, `/contact`, `/privacy`, `/terms` (legal pages are review-me templates)    |
| ✅     | RSS feed `/feed.xml`                  | Route handler, latest 50 published articles                                         |
| ✅     | Loading states                        | `loading.tsx` + `CardGridSkeleton` on home, category, article, author, game, tag    |
| ✅     | `next/image` everywhere               | Replaced raw `<img>`; media URLs absolutised; CMS host allowed via `remotePatterns` |
| ✅     | `tsconfig` baseUrl fix                | `@/*` alias now resolves reliably at build                                          |
| ✅     | Article page polish                   | Reading time (`lib/reading-time.ts`), share row (`ShareButtons`), "Read next" suggestions and prev/next nav (`fetchRelatedArticles` / `fetchAdjacentArticles`) |
| ✅     | Share targets                         | X, Reddit, Bluesky, WhatsApp + copy link, plus the **Web Share API** sheet where supported. No Discord/Messenger buttons on purpose: Discord has no web share intent, and Messenger's Send Dialog needs a Facebook App ID and doesn't work on mobile — the native sheet covers both |

### SEO

| Status | Item                         | Notes                                                                                      |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------ |
| ✅     | Site config + `metadataBase` | `lib/site.ts` reads `NEXT_PUBLIC_SITE_URL`; layout sets metadataBase + default canonical   |
| ✅     | `sitemap.xml`                | `app/sitemap.ts` — static pages + categories + all published articles/authors/games/tags   |
| ✅     | `robots.txt`                 | `app/robots.ts` — allows all but `/api`, `/account`, `/sign-in`, `/sign-up`; links sitemap |
| ✅     | Canonical URLs               | `alternates.canonical` on home, article, category, author, game, tag                       |
| ✅     | CMS `seo` fields used        | Article metadata prefers `seo.title` / `seo.description`, falls back to title/excerpt      |
| ✅     | Dynamic OG images            | `app/article/[slug]/opengraph-image.tsx` via `next/og` (branded, per-article)              |
| ✅     | JSON-LD                      | `NewsArticle` structured data on article pages, incl. `wordCount` + `timeRequired`         |

### Search (Meilisearch)

| Status | Item            | Notes                                                                                                               |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| ✅     | CMS indexing    | `meilisearch` client + `afterChange`/`afterDelete` hooks on Articles (published → upsert, else remove); best-effort |
| ✅     | Backfill script | `pnpm reindex:search` (CMS) re-creates index settings + indexes all published articles                              |
| ✅     | Search API      | `app/api/search/route.ts` proxies queries server-side; key never exposed                                            |
| ✅     | CMS fallback    | No Meilisearch (or Meilisearch down/unindexed) → `/api/search` queries the CMS instead (Postgres `ILIKE` on title + excerpt). Search never hard-fails; the response's `engine` field says which backend answered |
| ✅     | Search UI       | Header `SearchBar` + `/search` results page (robots: noindex)                                                       |
| ✅     | Local infra     | `docker-compose.yml` runs Meilisearch on :7700; env wired in both `.env.example`                                    |

## Auth

| Status | Item                             | Notes                                                              |
| ------ | -------------------------------- | ------------------------------------------------------------------ |
| ✅     | Clerk for readers (web)          | `ClerkProvider`, middleware, header Log in / Sign up, `UserButton` |
| ✅     | Sign-in / sign-up pages          | `/sign-in`, `/sign-up` (+ modal mode in header)                    |
| ✅     | Editor auth                      | Stays on Payload (CMS admin), separate from readers                |
| ⬜     | Protected reader area `/account` | Middleware matcher is ready; page not built yet                    |
| ⬜     | Sync Clerk users → CMS / DB      | For comments, favorites, etc.                                      |

## Mobile (Expo)

| Status | Item                        | Notes                         |
| ------ | --------------------------- | ----------------------------- |
| ✅     | Expo app consuming same API | Shares `api-client` + `types` |
| ⬜     | Clerk on mobile             | Reader auth parity with web   |
| ⬜     | Push notifications          | Expo                          |

## Docs & config

| Status | Item                       | Notes                                                                                                                                                                                                              |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅     | Root `README.md`           | Stack, structure, ports, install/dev flow, CI — points here for status                                                                                                                                             |
| ✅     | `apps/cms/README.md`       | Akavish-specific (was the Payload blank template)                                                                                                                                                                  |
| ✅     | `.env.example` files       | web (Clerk + CMS_URL + Meili + SITE_URL), cms (Postgres + URLs + Meili)                                                                                                                                            |
| ✅     | `.gitignore`               | Secrets (`.env*`, `/.clerk/`), payload-types, media and generated build state (`*.tsbuildinfo`) — verified ignored                                                                                                  |
| ✅     | Reset scripts              | `pnpm clean` (build + deps) · `pnpm reset:db [URL]` (wipe any Postgres DB — dev by default or prod by URL; no psql, uses `pg`)                                                                                     |
| ✅     | Root `CLAUDE.md` + `AGENTS.md` | Same working agreement for Claude and Codex: docs/config sweep, migration-vs-normal push, commit messages, project quick-reference                                                                            |
| ✅     | Repo structure audit       | Removed Payload-template leftovers (`.yarnrc`, nested `docker-compose.yml`/`pnpm-workspace.yaml`, `my-route`, demo `(frontend)`, `test.env`) + stray `package-lock.json`; npm/yarn/nested lockfiles now gitignored |
| ✅     | `packages/*` covered by CI | Each shared package now has a `tsconfig.json` + `type-check` script — previously turbo silently skipped them (no scripts = never checked)                                                                          |
| ✅     | `PROGRESS.md`              | This file                                                                                                                                                                                                          |

## CI/CD

| Status | Item                  | Notes                                                                                                                                                         |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | GitHub Actions CI     | `.github/workflows/ci.yml` on push to `main` + every PR                                                                                                       |
| ✅     | Lint + type-check job | Lint: web + CMS. Type-check: web, CMS + all shared packages. Mobile excluded.                                                                                |
| ✅     | Build job             | `pnpm build` (web + CMS) with a Postgres service + dummy env                                                                                                  |
| ✅     | ESLint flat configs   | web + cms use `eslint.config.mjs` importing `eslint-config-next`'s native flat presets (no FlatCompat, no `next lint`); web bumped to `eslint-config-next@16` |
| ✅     | Link hygiene          | Internal `<a>` → `next/link` `<Link>` across web (fixes `no-html-link-for-pages`)                                                                             |
| ✅     | `type-check` scripts  | Added to root (turbo) and CMS                                                                                                                                 |
| ✅     | CI runtime hygiene    | GitHub Actions uses Node 22 LTS plus Node-24-compatible action runtimes (`checkout@v5`, `setup-node@v5`, `pnpm/action-setup@v4.4.0`)                        |
| ✅     | Workspace dependency hygiene | `@akavish/ui` explicitly declares its `@akavish/types` workspace dependency, so isolated CI installs resolve it correctly                              |
| ✅     | API client type environment | `@akavish/api-client` explicitly includes DOM fetch types and Node 22 process types, so isolated CI type-checks match its web/Expo runtime contract     |
| ✅     | pnpm 10 fix           | Moved `overrides` + `onlyBuiltDependencies` to `pnpm-workspace.yaml` (pnpm 10 ignores the `pnpm` package.json field)                                          |

## Deployment (prep)

| Status | Item                          | Notes                                                                                                                                            |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅     | Deployment guide              | `DEPLOYMENT.md` — web→Vercel, CMS→Railway, Neon, search, domains, checklist + env reference + schema/migrations explainer                        |
| ✅     | **Deployed & LIVE**           | Web on Vercel (`akavish.gg`) + CMS on Railway (`cms.akavish.gg`) + prod Neon DB, all serving real content 🎉 The platform URLs still resolve but nothing links to them |
| ✅     | Build resilience              | CMS fetches have an 8s timeout (`lib/payload.ts`) so a slow/down CMS never hangs the Vercel build                                                |
| ✅     | Versioned database migrations | CMS uses committed migrations with `push: false`; `pnpm migrate` is applied locally and by Railway before production deploys                     |

---

# In progress / next up

**Recommended order** — the backlog below is grouped by area; this is the order to
actually tackle it, best value-for-effort first.

| #   | Task                                | Why now                                                                                                                                                | Effort |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | ✅ Railway pre-deploy migrate       | Done — future schema changes reach prod automatically                                                                                                   | —      |
| 2   | ✅ **Image sizes** (`imageSizes`)   | Done — `thumbnail`/`card`/`hero`/`square` variants generated on upload; web picks the right one per context                                             | —      |
| 3   | ✅ **Custom domain + email**        | Live on `akavish.gg` (web, Vercel) + `cms.akavish.gg` (Railway), DNS on Cloudflare, DNSSEC on, env vars swapped, `www` 308s to the apex, and `hello@`/`tips@`/`privacy@` forward via Cloudflare Email Routing. Clerk stays on dev keys for now (prod instance is paid, reader accounts unused) — see `DEPLOYMENT.md` §6 | —      |
| 4   | ✅ **Email adapter**                | Done — `@payloadcms/email-resend` wired in `payload.config.ts`; password resets are really sent, with a branded HTML template (`lib/emails/forgot-password.ts`). Off when `RESEND_API_KEY` is unset (console fallback). Setup + DNS in `DEPLOYMENT.md` §4c | —      |
| 5   | ✅ **Search works in prod**         | Done — `/api/search` falls back to the CMS (Postgres `ILIKE`) when Meilisearch isn't configured, and when it errors. The header search box was returning 503 on every page; now it works for free. `DEPLOYMENT.md` §4 | —      |
| 6   | ✅ **Article page polish**          | Done — reading time (+ `wordCount`/`timeRequired` in the JSON-LD), share row, "Read next" suggestions, prev/next nav. Suggestions fail soft: a CMS error drops them instead of breaking the page | —      |
| 7   | ⬜ Error monitoring (Sentry)        | Know when prod breaks instead of finding out by chance                                                                                                  | ~30 min |
| 8   | ⬜ Legal content review             | `/privacy` + `/terms` are placeholder templates — real text needed before pushing traffic                                                                | ?      |

> **Sending vs receiving — two different things, both now in place.** Resend
> (task 4) **sends** Payload's password resets from `mail.akavish.gg`. Cloudflare
> Email Routing (task 3) only **receives**, forwarding `hello@`/`tips@`/`privacy@`
> to a personal inbox. Neither can do the other's job.

Then, as it comes: SEO defaults hook · pagination · homepage hero/featured ·
accessibility pass · analytics · mobile track (Expo SDK 53 + `api-client` shape
fix) · i18n · comments (see §5 — needs traffic and paid Clerk first).

| Status | Item            | Notes                                                                                                                                            |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅     | **Media on R2** | Live — uploads go to Cloudflare R2 and are served from `*.r2.dev`; images now survive Railway redeploys. Setup documented in `DEPLOYMENT.md` §4b. |

---

# Backlog — everything left to do

Grouped by area. Rough priority: **P1** = needed before a public launch ·
**P2** = strongly wanted soon after · **P3** = nice-to-have / later.

## 1. Website (public frontend — `apps/web`)

### Pages & navigation

| Pri | Item                         | Notes                                                                                       |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| ✅  | Single article polish        | Done — reading time in the byline, share row (X/Reddit/Bluesky/WhatsApp + native share sheet + copy link), "Read next" suggestions and prev/next navigation |
| P2  | Legal content review         | `/privacy` and `/terms` are placeholder templates — need real legal text before launch      |
| P2  | Pagination / infinite scroll | Home + category + tag pages currently cap at N items                                        |
| P2  | Homepage layout pass         | Featured/hero article, “trending”, section blocks instead of one flat grid                  |
| P2  | Newsletter signup            | Capture emails (needs an ESP: Resend/Mailchimp/etc.)                                        |
| P3  | Search polish                | Highlighting, filters by category, instant/typeahead results                                |
| P3  | Dark/light toggle            | Currently dark-only                                                                         |
| P3  | Comments                     | Reader comments (needs reader auth + a comments store/service)                              |

### UX & quality

| Pri | Item                    | Notes                                                                    |
| --- | ----------------------- | ------------------------------------------------------------------------ |
| P2  | Mobile responsive audit | Verify header nav, cards, article/game/author pages on small screens     |
| P2  | Accessibility pass      | Alt text, focus states, color contrast, keyboard nav, semantic landmarks |
| P3  | Analytics               | Plausible / GA / Vercel Analytics                                        |

## 2. SEO

Core SEO is done (see the [Done → SEO](#seo) section). Remaining:

| Pri | Item                            | Notes                                                     |
| --- | ------------------------------- | --------------------------------------------------------- |
| P2  | OG images for non-article pages | Author/game/tag/category `opengraph-image` (article done) |
| P3  | Breadcrumb JSON-LD              | `BreadcrumbList` schema on detail pages                   |
| P3  | Per-locale hreflang             | Only once i18n lands (area 6)                             |

## 3. CMS / back-office (`apps/cms`)

### Content modeling

| Pri | Item                          | Notes                                                                          |
| --- | ----------------------------- | ------------------------------------------------------------------------------ |
| P1  | Required SEO defaults         | Auto-fill `seo.title`/`description` from title/excerpt via a hook if empty     |
| P1  | Author ↔ user link            | Connect a CMS `user` (editor) to an `author` profile                           |
| P2  | Editorial workflow            | Roles (admin / editor / writer) + access control per role; review/publish flow |
| P2  | Scheduled publishing          | Publish at a future `publishedAt` (cron or Payload job)                        |
| P2  | Homepage curation             | A “featured” flag or a singleton “Homepage” global to pick the hero            |
| P2  | Redirects collection          | Manage slug changes without breaking links (`@payloadcms/plugin-redirects`)    |
| P3  | i18n fields                   | Localized title/content if going bilingual (area 6)                            |
| P3  | Related games/series taxonomy | Beyond single `game` relation                                                  |

### Media & storage

| Pri | Item                          | Notes                                                                   |
| --- | ----------------------------- | ----------------------------------------------------------------------- |
| ✅  | Cloudflare R2 storage adapter | Done — `@payloadcms/storage-s3` wired to R2, live in prod |
| ✅  | Image sizes / focal point     | Done — `imageSizes` (thumbnail/card/hero/square) + focal point on the `media` collection; web requests the right variant |
| P2  | Alt text required on media    | Accessibility + SEO                                                     |

### Operational

| Pri | Item                 | Notes                                                                                                          |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| ✅  | Email adapter        | Done — `@payloadcms/email-resend` sends password resets from `mail.akavish.gg`; falls back to console logging when `RESEND_API_KEY` is unset |
| ✅  | Versioned migrations | Done — `push: false`, migrations committed, applied locally and by Railway's pre-deploy step. See `DEPLOYMENT.md` §5 |
| P2  | Seed script          | Script to create an admin user + sample content for fresh installs                                             |
| P2  | Backups              | Automated DB backups (Neon has PITR; document the policy)                                                      |

## 4. Search (Meilisearch)

Core search is done (see the [Done → Search](#search-meilisearch) section). Remaining:

| Pri | Item                        | Notes                                                           |
| --- | --------------------------- | --------------------------------------------------------------- |
| P3  | Hosted Meilisearch for prod | No longer urgent — `/api/search` falls back to the CMS (Postgres `ILIKE`), so search works in prod for free. Upgrade when article volume makes typo tolerance and ranking worth $20+/mo (Cloud has no free tier) or self-host on Railway |
| P3  | Search-only API key         | Generate a scoped key in prod instead of reusing the master key |
| P3  | Typeahead / filters         | Instant results in the header, filter by category/game          |

## 5. Auth & reader features

| Pri | Item                      | Notes                                                         |
| --- | ------------------------- | ------------------------------------------------------------- |
| P2  | `/account` page           | Profile, saved articles (middleware matcher already in place) |
| P2  | Clerk → DB sync           | Webhook to mirror Clerk users into Postgres for app data      |
| P2  | Clerk on mobile           | Reader auth parity in the Expo app                            |
| P3  | Saved/bookmarked articles | Per-user, needs the DB link above                             |
| P3  | Social login providers    | Configure Google/Discord/etc. in Clerk                        |
| P3  | **Comments**              | Deliberately deferred until there's traffic — an empty comment box under every article reads worse than none. Two costs to accept first: it forces **Clerk production keys** (paid), and a Payload `comments` collection is a 🟠 migration plus moderation, rate limiting and anti-spam to build. Third-party alternatives: Giscus (free but requires a GitHub account, poor fit for gaming readers) or Hyvor (~5 €/mo, Clerk-independent) |

## 6. Internationalization (EN + FR)

| Pri | Item              | Notes                                                    |
| --- | ----------------- | -------------------------------------------------------- |
| P3  | Frontend i18n     | `next-intl` or App Router locale segments (`/en`, `/fr`) |
| P3  | Localized content | Payload localization on article fields                   |
| P3  | Locale switcher   | Header control + `hreflang` tags                         |

## 7. Mobile (`apps/mobile`)

| Pri | Item                              | Notes                                                                                                                                                                                                                                                                 |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Upgrade Expo to SDK 53 (React 19) | Mobile is on Expo 52 / React 18 while web+cms are React 19. A repo-wide `react: 19` override forces RN onto React 19 (unsupported on SDK 52). Mobile is currently **excluded from the CI type-check** (`--filter=!@akavish/mobile`) until it's on a React-19 Expo SDK |
| P1  | Fix api-client ↔ Payload shape    | `articlesApi.list` is typed `PaginatedResponse` (`.data`) but hits Payload's REST which returns `{docs,…}` — mobile's `res.data` is undefined at runtime. Align the shared client with the web's `lib/payload.ts` mapping                                             |
| P2  | Feature parity audit              | Home, category, article detail consuming the CMS API                                                                                                                                                                                                                  |
| P2  | Push notifications                | Expo notifications on new articles                                                                                                                                                                                                                                    |
| P3  | App store assets                  | Icons, splash, screenshots, listing copy                                                                                                                                                                                                                              |
| P3  | EAS build & submit                | iOS + Android pipelines                                                                                                                                                                                                                                               |

## 8. Infrastructure, CI/CD & deployment

### Docker

| Pri | Item                         | Notes                                                                              |
| --- | ---------------------------- | ---------------------------------------------------------------------------------- |
| P2  | Dockerfile for web           | Multi-stage Next.js build                                                          |
| P2  | Dockerfile for CMS           | Payload already ships a starter `apps/cms/Dockerfile` — adapt it                   |
| P2  | Extend root `docker-compose` | Now runs Meilisearch ✅; add web + CMS + Postgres for a full one-command dev stack |

### CI (GitHub Actions or similar)

Lint + type-check + build on PR are done (see [Done → CI/CD](#cicd)). Remaining:

| Pri | Item                     | Notes                                                                                            |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| P2  | Lint + type-check mobile | Give the Expo app a working ESLint config + re-include it in CI once it's on a React-19 Expo SDK |
| P2  | Run tests in CI          | CMS has Vitest (int) + Playwright (e2e) — wire them into the workflow                            |
| P2  | Preview deploys          | Vercel preview per PR                                                                            |
| P3  | Dependabot / renovate    | Dependency updates                                                                               |

### Deployment (production)

📄 Full runbook: **[`DEPLOYMENT.md`](./DEPLOYMENT.md)**. The steps below are the
checklist it walks through.

| Pri | Item                  | Notes                                                                                                                                              |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | Custom domains + DNS      | Done — `akavish.gg` (web) + `cms.akavish.gg` (CMS) on Cloudflare DNS, prod URLs wired, `www` 308s to the apex, Email Routing forwarding          |
| P2  | Production Clerk instance | Deferred on purpose — the dev instance works on the custom domain and reader accounts are unused. Switch to `pk_live_…` / `sk_live_…` (and set Clerk's allowed origins) when accounts start to matter |
| P2  | CDN / caching             | Cache headers + ISR tuning; R2/Cloudflare in front of media                                                                                        |
| P2  | Mobile release            | Expo EAS build + store submission                                                                                                                  |
| P3  | Staging environment       | Mirror of prod for QA                                                                                                                              |

## 9. Observability, security & legal

| Pri | Item               | Notes                                                                  |
| --- | ------------------ | ---------------------------------------------------------------------- |
| P1  | Error monitoring   | Sentry (web + CMS)                                                     |
| P1  | Secrets management | Move from `.env` files to the host's secret store in prod              |
| P2  | Rate limiting      | On public API routes                                                   |
| P2  | Uptime monitoring  | Healthcheck + alerting on web/CMS                                      |
| P2  | Legal pages        | Privacy policy, terms, cookie notice (needed for Clerk/analytics/GDPR) |
| P2  | Cookie consent     | If using analytics/tracking in the EU                                  |
| P3  | Logging            | Structured logs shipped somewhere queryable                            |

## 10. Testing & docs

| Pri | Item                 | Notes                                                                  |
| --- | -------------------- | ---------------------------------------------------------------------- |
| P2  | Web tests            | The CMS has tests; the web app has none yet (unit + a couple of e2e)   |
| P2  | API contract checks  | Guard the Payload→web mapping in `lib/payload.ts` against schema drift |
| P3  | Contributor docs     | How to add a collection, a page, run tests                             |
| P3  | Architecture diagram | One picture of web ↔ CMS ↔ DB ↔ services                               |

---

## Known notes / gotchas

- Run the CMS and web as **two separate processes** (ports 3001 and 3000).
- Articles must be **Published** to appear publicly; drafts are editor-only.
- Stick to **Node 20/22 LTS** — Node 25 ran the CMS out of heap memory.
- New CMS collections default to **private** reads — add `access.read` if the
  frontend needs them.
- The CMS schema is managed by **versioned migrations** (`push: false`). Change a
  collection → `pnpm migrate:create <name>` + `pnpm migrate`, commit; Railway's
  pre-deploy applies them to prod. See `DEPLOYMENT.md` §5.
- **React types / `shamefully-hoist`:** the repo's `.npmrc` flattens deps into
  the root `node_modules`, so the mobile app's `@types/react@18` lands at
  `node_modules/@types/react` and `tsc` would pick it up for web/cms (React 19),
  causing bogus "Suspense/ClerkProvider cannot be used as a JSX component" and
  "bigint not assignable to ReactNode" errors. Fixed by `paths` overrides in
  `apps/web/tsconfig.json` and `apps/cms/tsconfig.json` that pin `react` /
  `react-dom` type resolution to each app's own React 19 copy. Don't remove
  those `paths` entries.
