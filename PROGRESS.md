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
| ✅     | Footer pages                          | `/about`, `/contact`, plus the legal set below                                       |
| ✅     | Legal pages (EN + FR)                 | `/privacy`, `/terms`, `/legal` and `/fr/confidentialite`, `/fr/conditions`, `/fr/mentions-legales`. Facts (processors, publisher, date) live once in `lib/legal.ts`; hreflang pairs + language toggle via `LegalLanguageSwitch` |
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
| ✅     | `sitemap.xml`                | `app/sitemap.ts` — static pages + categories + published articles, and only the authors/games/tags that have at least one published article (empty taxonomy pages are thin content) |
| ✅     | `robots.txt`                 | `app/robots.ts` — allows all but `/api`, `/account`, `/sign-in`, `/sign-up`; links sitemap |
| ✅     | Canonical URLs               | `alternates.canonical` on home, article, category, author, game, tag                       |
| ✅     | CMS `seo` fields used        | Article metadata prefers `seo.title` / `seo.description`, falls back to title/excerpt      |
| ✅     | Dynamic OG images            | Shared design in `lib/og.tsx`; site default + article, category, author, game, tag routes   |
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
| ✅     | Lint + type-check job | Lint: web, CMS + mobile. Type-check: web, CMS, mobile + all shared packages (mobile back in CI since the Expo 58 upgrade).                                   |
| ✅     | Build job             | `pnpm build` (web + CMS) with a Postgres service + dummy env                                                                                                  |
| ✅     | ESLint flat configs   | web + cms use `eslint.config.mjs` importing `eslint-config-next`'s native flat presets (no FlatCompat, no `next lint`); web bumped to `eslint-config-next@16` |
| ✅     | Link hygiene          | Internal `<a>` → `next/link` `<Link>` across web (fixes `no-html-link-for-pages`)                                                                             |
| ✅     | `type-check` scripts  | Added to root (turbo) and CMS                                                                                                                                 |
| ✅     | CI runtime hygiene    | GitHub Actions uses Node 22 LTS plus Node-24-compatible action runtimes (`checkout@v5`, `setup-node@v5`, `pnpm/action-setup@v4.4.0`)                        |
| ✅     | Workspace dependency hygiene | `@akavish/ui` explicitly declares its `@akavish/types` workspace dependency, so isolated CI installs resolve it correctly                              |
| ✅     | API client type environment | `@akavish/api-client` explicitly includes DOM fetch types and Node 22 process types, so isolated CI type-checks match its web/Expo runtime contract     |
| ✅     | pnpm 10 adoption      | `packageManager` pins pnpm 10.34.5 (was 9.0.0 while the lockfile was pnpm-10-generated). `onlyBuiltDependencies` lives in `pnpm-workspace.yaml`, where pnpm 10 reads it. The dormant React `overrides` were **removed** rather than activated — see the gotcha below |

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
| 7   | ✅ **Observability**                | Done — Vercel Web Analytics (cookieless, 50k events/mo free) + Sentry errors & tracing on web and CMS. Both no-op without config. `DEPLOYMENT.md` §4d | —      |
| 8   | ✅ **Legal pages**                  | Done — real `/privacy`, `/terms`, `/legal` (LCEN notice) in EN + FR, written from the actual processor list (`lib/legal.ts`). Sentry PII collection explicitly disabled so the policy is true. **Not reviewed by a lawyer** | —      |
| 9   | ✅ **Homepage layout**              | Done — masthead with real section links, lead story + "Top stories" column, one section per category from the remaining articles (no duplicates). Degrades cleanly down to one article or an empty state. Skeleton in `loading.tsx` mirrors it | —      |
| 10  | ✅ **Reader-facing fallbacks**      | Done — the home and category pages showed developer instructions to the public ("Make sure the CMS is running on localhost:3001", "Publish an article in the CMS"). Now `components/StatusMessage.tsx` | —      |
| 11  | ✅ **Secret-rotation runbook**      | Done — `DEPLOYMENT.md` §8, written after the October 2026 Railway incident: inventory, order of operations, pitfalls, rotation log | —      |
| 12  | ✅ **Expo SDK upgrade**             | Done — SDK 52 → 58 (React 19.3, RN 0.88), validated on an iPhone in Expo Go. Mobile is back in CI lint + type-check. Details in §7 | —      |
| 13  | ✅ **Nightly DB backups**           | Done — `.github/workflows/backup.yml`: `pg_dump` of prod → **private** R2 bucket, 30-day lifecycle. Needs one-time setup (bucket, token, GitHub secrets) — `DEPLOYMENT.md` §9 | —      |
| 14  | ✅ **Slug redirects**               | Done — renaming a published article records the old slug (`previousSlugs`); old URLs 308 to the new one | —      |
| 15  | ✅ **Unit tests**                   | Done — vitest on the shared Payload mapper, reading time and the web ↔ CMS category list; `pnpm test`, run in CI | —      |
| 16  | ✅ **Share images everywhere**      | Done — one design (`lib/og.tsx`) for a site-wide default plus category, author, game and tag pages. Fixed the wordmark rendering as "Akav ish" | —      |
| 17  | ✅ **Local dev DB in Docker**       | Done — the Neon dev project and the Railway dev environment were deleted; local dev uses Postgres from `docker-compose.yml` | —      |
| 18  | ✅ **Seed script**                  | Done — `pnpm seed`: admin (only on an empty DB) + 8 fictional articles across all 6 categories, with author, games, tags and generated covers. Re-runnable, refuses any non-localhost `DATABASE_URL` | —      |
| 19  | ⬜ **Uptime monitoring**            | Free external check (UptimeRobot / Better Stack) on `akavish.gg` and `cms.akavish.gg` — the Railway outage was discovered by email | ~15 min |
| 20  | ⬜ **Mobile + accessibility audit** | The site on a phone; keyboard navigation, focus states, contrast, screen-reader landmarks | 1–2 h  |

> **Sending vs receiving — two different things, both now in place.** Resend
> (task 4) **sends** Payload's password resets from `mail.akavish.gg`. Cloudflare
> Email Routing (task 3) only **receives**, forwarding `hello@`/`tips@`/`privacy@`
> to a personal inbox. Neither can do the other's job.

**Order:** #19 monitoring → #20 audit. That's the whole
list of work worth doing *now*.

**After that, everything left waits on something:**

| Waits on | Items (in the backlog below) |
| --- | --- |
| **More than one writer** | Editorial roles & review flow · author ↔ CMS user link |
| **The app being shipped** | Push notifications · store release (EAS) · app store assets · mobile feature parity |
| **Traffic** | CDN / cache tuning · rate limiting on public APIs · reader accounts (`/account`, Clerk → DB sync) |
| **Content and readers** | Everything in **🅿️ Parked**: AI news scout, scheduled publishing, newsletter, pagination, analytics review, comments, Clerk production |
| **Money / launch** | Legal review by a professional (before monetising) |

i18n (EN + FR) is its own project — §6.

> **The real bottleneck is content, not code.** The production CMS has had zero
> articles since October 2026. Pagination, analytics and search polish only mean
> something once there's a steady publishing rhythm.

| Status | Item            | Notes                                                                                                                                            |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅     | **Media on R2** | Live — uploads go to Cloudflare R2 and are served from `*.r2.dev`; images now survive Railway redeploys. Setup documented in `DEPLOYMENT.md` §4b. |

---

# 🅿️ Parked — good ideas, deliberately not now

Kept here so they aren't lost. Each one only pays off with **content and
readers**, which the site doesn't have yet — revisit once publishing is regular.

| Idea | Why it waits / what it depends on |
| --- | --- |
| **AI news scout** | A bot that watches the big news/leak sites and leaker accounts, drafts articles, and sends them for human approval before publishing. Ties together scheduled publishing and email. Open design questions (sources, copyright, X/Twitter API cost, AI-content disclosure) — see the discussion before building anything |
| Scheduled publishing | Publish at a future `publishedAt` (cron or a Payload job). Most useful together with the AI scout: approve in the evening, publish in the morning |
| Newsletter | Capture emails and send a digest (Resend can do it). The one channel that brings readers back without Google or social. Needs a consent flow and a `/privacy` update |
| Pagination / infinite scroll | Pages cap at 24 articles — irrelevant until there are more |
| Analytics review | Vercel Analytics is collecting; reading it means something once there's traffic |
| Comments | Needs traffic, paid Clerk production keys, moderation and anti-spam (§5) |
| Clerk production instance | Paid; only needed once reader accounts do something (§8) |

### AI news scout — brief and open questions

**The idea (Alex, Nov 2026):** a bot — an AI assistant — that regularly goes
through the best-known gaming news and leak sites, and the X/Twitter profiles of
known leakers and news accounts, picks up stories worth covering, **writes the
articles**, and sends them to Alex **for validation** before anything is
published. Linked to scheduled publishing (approved drafts go out at a set time)
and to the newsletter (the same pipeline can feed a digest).

**Likely shape:** a scheduled job collects sources → an LLM deduplicates against
what's already on the site, ranks, and drafts → each draft is created in the CMS
as a **draft** (never published by the bot) → Alex gets a summary with links,
edits/approves in `/admin`. Nothing goes live without a human.

**Constraints already identified:**

- **X/Twitter:** the API is paid and scraping breaks their terms of service.
  Start with RSS feeds of news sites and Reddit (e.g. r/GamingLeaksAndRumours),
  which are meant to be consumed; add X only if the cost is justified.
- **Copyright / duplicate content:** drafts must **synthesise and cite** several
  sources with links, never paraphrase a single competitor's article — a legal
  requirement and what keeps Google from treating the pages as copies.
- **Leaks:** the bot will surface unverified claims; drafts must name their
  sources and follow the leak-labelling commitment in `/terms`.
- **AI-content transparency:** EU rules require disclosure for AI-generated text,
  with lighter obligations when a human reviews it and takes editorial
  responsibility — check precisely before launch, and update `/terms` (and
  `lib/legal.ts` if a new service ever sees visitor data).
- **Cost:** LLM API usage per draft, plus any paid source API.

**Questions to answer before designing it:**

1. How many drafts a day are wanted?
2. Which sources exactly — sites, subreddits, accounts?
3. How should validation happen — email digest, or the Akavish Discord server
   with "publish / reject" buttons?
4. What monthly API budget is acceptable?

---

# Backlog — everything left to do

Grouped by area. Rough priority: **P1** = needed before a public launch ·
**P2** = strongly wanted soon after · **P3** = nice-to-have / later.

## 1. Website (public frontend — `apps/web`)

### Pages & navigation

| Pri | Item                         | Notes                                                                                       |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| ✅  | Single article polish        | Done — reading time in the byline, share row (X/Reddit/Bluesky/WhatsApp + native share sheet + copy link), "Read next" suggestions and prev/next navigation |
| P2  | Legal review by a professional | The pages are written and factually accurate, but **not reviewed by a lawyer**. Worth doing before monetising (affiliate/sponsored disclosures) or if traffic grows |
| ✅  | Homepage layout pass         | Done — lead story, top stories, per-category sections (see roadmap #9). "Trending" would need view counts, not available yet |
| P3  | Search polish                | Highlighting, filters by category, instant/typeahead results                                |
| P3  | Dark/light toggle            | Currently dark-only                                                                         |
| P3  | Comments                     | Reader comments (needs reader auth + a comments store/service)                              |

### UX & quality

| Pri | Item                    | Notes                                                                    |
| --- | ----------------------- | ------------------------------------------------------------------------ |
| P2  | Mobile responsive audit | Verify header nav, cards, article/game/author pages on small screens     |
| P2  | Accessibility pass      | Alt text, focus states, color contrast, keyboard nav, semantic landmarks |
| ✅  | Analytics               | Vercel Web Analytics — cookieless, 50k events/month free, no consent banner needed. Enable it in the Vercel dashboard to start collecting |

## 2. SEO

Core SEO is done (see the [Done → SEO](#seo) section). Remaining:

| Pri | Item                            | Notes                                                     |
| --- | ------------------------------- | --------------------------------------------------------- |
| ✅  | OG images for non-article pages | Done — shared `lib/og.tsx`; default + category/author/game/tag |
| P3  | Breadcrumb JSON-LD              | `BreadcrumbList` schema on detail pages                   |
| P3  | Per-locale hreflang             | Only once i18n lands (area 6)                             |

## 3. CMS / back-office (`apps/cms`)

### Content modeling

| Pri | Item                          | Notes                                                                          |
| --- | ----------------------------- | ------------------------------------------------------------------------------ |
| ✅  | Auto `publishedAt`            | `beforeChange` hook stamps the publish date; re-saving an undated published article backfills from `createdAt`. Fixes the missing byline date, JSON-LD `datePublished`, prev/next nav and `-publishedAt` sorting |
| ✅  | Required SEO defaults         | Already covered at render time: article metadata falls back to title/excerpt when the SEO fields are empty |
| P3  | Author ↔ user link            | Connect a CMS `user` (editor) to an `author` profile. Only matters once there's more than one writer |
| P2  | Editorial workflow            | Roles (admin / editor / writer) + access control per role; review/publish flow |
| P2  | Homepage curation             | A “featured” flag or a singleton “Homepage” global to pick the hero            |
| ✅  | Slug redirects                | Done — `previousSlugs` on Articles, filled by a hook on rename; the article page 308-redirects old URLs. No separate redirects collection needed |
| P3  | i18n fields                   | Localized title/content if going bilingual (area 6)                            |
| P3  | Related games/series taxonomy | Beyond single `game` relation                                                  |

### Media & storage

| Pri | Item                          | Notes                                                                   |
| --- | ----------------------------- | ----------------------------------------------------------------------- |
| ✅  | Cloudflare R2 storage adapter | Done — `@payloadcms/storage-s3` wired to R2, live in prod |
| ✅  | Image sizes / focal point     | Done — `imageSizes` (thumbnail/card/hero/square) + focal point on the `media` collection; web requests the right variant |
| ✅  | Alt text required on media    | Already the case — `alt` is `required: true` in `Media.ts`              |

### Operational

| Pri | Item                 | Notes                                                                                                          |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| ✅  | Email adapter        | Done — `@payloadcms/email-resend` sends password resets from `mail.akavish.gg`; falls back to console logging when `RESEND_API_KEY` is unset |
| ✅  | Versioned migrations | Done — `push: false`, migrations committed, applied locally and by Railway's pre-deploy step. See `DEPLOYMENT.md` §5 |
| ✅  | Seed script          | Done — `pnpm seed` (local DBs only), see the roadmap (#18) and the README                                     |
| ✅  | Backups              | Nightly `pg_dump` → private R2 bucket via GitHub Actions; restore runbook in `DEPLOYMENT.md` §9 |

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

## 6. Internationalization (EN + FR)

| Pri | Item              | Notes                                                    |
| --- | ----------------- | -------------------------------------------------------- |
| P3  | Frontend i18n     | `next-intl` or App Router locale segments (`/en`, `/fr`) |
| P3  | Localized content | Payload localization on article fields                   |
| P3  | Locale switcher   | Header control + `hreflang` tags                         |

## 7. Mobile (`apps/mobile`)

| Pri | Item                              | Notes                                                                                                                                                                                                                                                                 |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | Upgrade Expo SDK 52 → 58          | Done (Nov 2026) — Expo 58.0 / React 19.3 / RN 0.88 / TypeScript 6, Node ≥ 22.13 for the mobile app. Splash moved from `app.json#splash` to the `expo-splash-screen` plugin; ESLint 9 flat config (`eslint.config.js`); expo-router's peers (`expo-linking`, `expo-constants`, `@expo/metro-runtime`) declared explicitly; unused `expo-notifications` and `@react-navigation/native` removed (push notifications come back with the item below). `types/expo.d.ts` keeps Expo's global types available in CI, where the generated `expo-env.d.ts` doesn't exist. Validated on an iPhone in Expo Go (needs an Expo account signed in on both the phone and `npx expo login`). Back in CI lint + type-check |
| ✅  | Fix api-client ↔ Payload shape    | Done — the Payload → `Article` mapper now lives in `@akavish/api-client/payload` and both web and mobile use it. `articlesApi.list` really returns `PaginatedResponse<Article>` (mobile's `res.data` was undefined), filters to published, populates relations; `get` no longer interpolates the slug raw into the URL |
| P2  | Feature parity audit              | Home, category, article detail consuming the CMS API. Today: Home lists articles (no tap action — there is no article screen yet); Leaks / Reviews / Esport are "coming soon" placeholders                                                                            |
| P3  | Drop the React `paths` workaround? | Added to web/CMS tsconfigs when mobile hoisted `@types/react@18`. Mobile is now on React 19.3 (web 19.2), so it may be removable — remove the `react*` paths, run `pnpm type-check`, keep them if it breaks |
| P2  | Push notifications                | Expo notifications on new articles                                                                                                                                                                                                                                    |
| P3  | App store assets                  | Icons, splash, screenshots, listing copy                                                                                                                                                                                                                              |
| P3  | EAS build & submit                | iOS + Android pipelines                                                                                                                                                                                                                                               |

## 8. Infrastructure, CI/CD & deployment

### Docker

| Pri | Item                         | Notes                                                                              |
| --- | ---------------------------- | ---------------------------------------------------------------------------------- |
| P2  | Dockerfile for web           | Multi-stage Next.js build                                                          |
| P2  | Dockerfile for CMS           | Payload already ships a starter `apps/cms/Dockerfile` — adapt it                   |
| ✅  | Extend root `docker-compose` | Postgres + Meilisearch for local dev. Web and CMS still run via `pnpm dev` (faster reloads than containers) |

### CI (GitHub Actions or similar)

Lint + type-check + build on PR are done (see [Done → CI/CD](#cicd)). Remaining:

| Pri | Item                     | Notes                                                                                            |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| P2  | Lint + type-check mobile | Give the Expo app a working ESLint config + re-include it in CI once it's on a React-19 Expo SDK |
| P2  | CMS tests in CI          | Unit tests (web + api-client) run in CI ✅. The CMS's own Vitest int + Playwright e2e suites aren't wired in yet — they need a seeded DB and browsers |
| P2  | Preview deploys          | Vercel preview per PR                                                                            |
| P3  | Dependabot / renovate    | Dependency updates                                                                               |

### Deployment (production)

📄 Full runbook: **[`DEPLOYMENT.md`](./DEPLOYMENT.md)**. The steps below are the
checklist it walks through.

| Pri | Item                  | Notes                                                                                                                                              |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | Custom domains + DNS      | Done — `akavish.gg` (web) + `cms.akavish.gg` (CMS) on Cloudflare DNS, prod URLs wired, `www` 308s to the apex, Email Routing forwarding          |
| P2  | CDN / caching             | Cache headers + ISR tuning; R2/Cloudflare in front of media                                                                                        |
| P2  | Mobile release            | Expo EAS build + store submission                                                                                                                  |
| P3  | Staging environment       | Mirror of prod for QA                                                                                                                              |

## 9. Observability, security & legal

| Pri | Item               | Notes                                                                  |
| --- | ------------------ | ---------------------------------------------------------------------- |
| ✅  | Error monitoring   | Sentry on web (client + server + edge, tunnelled through `/monitoring`) and CMS (server only). Errors + performance tracing, sampled to fit the free tier. Session Replay off on privacy grounds |
| ✅  | Secrets management | Prod secrets live only in Railway / Vercel / GitHub secrets, never in committed files; rotation runbook in `DEPLOYMENT.md` §8 |
| P2  | Rate limiting      | On public API routes                                                   |
| P2  | Uptime monitoring  | Healthcheck + alerting on web/CMS                                      |
| ✅  | Legal pages        | Done — `/privacy`, `/terms`, `/legal` in EN + FR (roadmap #8)          |
| ✅  | Cookie consent     | Not needed: cookieless analytics, only strictly necessary Clerk cookies — explained in `/privacy` |
| P3  | Logging            | Structured logs shipped somewhere queryable                            |

## 10. Testing & docs

| Pri | Item                 | Notes                                                                  |
| --- | -------------------- | ---------------------------------------------------------------------- |
| ✅  | Unit tests           | vitest in `apps/web` and `packages/api-client`, `pnpm test`, run in CI. Next: e2e on key pages |
| ✅  | API contract checks  | The shared mapper is unit-tested, and a test fails if the web and CMS category lists drift |
| P3  | Contributor docs     | How to add a collection, a page, run tests                             |
| P3  | Architecture diagram | One picture of web ↔ CMS ↔ DB ↔ services                               |

---

## Known notes / gotchas

- Run the CMS and web as **two separate processes** (ports 3001 and 3000).
- Articles must be **Published** to appear publicly; drafts are editor-only.
- Use **Node 22 LTS (≥ 22.13)** — required by Expo 58 for the mobile app; web and
  CMS also run on Node 20. Avoid Node 25: it ran the CMS out of heap memory.
- **Don't import from `apps/cms/src/payload-types.ts`.** It's generated by
  `pnpm generate:types` and gitignored, so it exists on your machine but not in
  CI: the import type-checks locally and fails `pnpm type-check` in CI (it broke
  the first push of `pnpm seed`). Spell out the few types needed instead.
- New CMS collections default to **private** reads — add `access.read` if the
  frontend needs them.
- The CMS schema is managed by **versioned migrations** (`push: false`). Change a
  collection → `pnpm migrate:create <name>` + `pnpm migrate`, commit; Railway's
  pre-deploy applies them to prod. See `DEPLOYMENT.md` §5.
- **Categories have one source: `apps/web/src/lib/categories.ts`.** Slug (`leaks`),
  CMS value (`leak`) and labels live there; it must match the `category` select
  options in `apps/cms/src/collections/Articles.ts`. A few components still keep
  their own singular-label map (`ArticleCard`, the article page, `SearchResults`,
  the OG image) — migrate them when next touched.
- **Never show operational details to readers.** Fallbacks go through
  `components/StatusMessage.tsx`; diagnostics belong in Sentry and the logs.
- **`app/loading.tsx` mirrors the home layout** — change one, change the other,
  or the page jumps when content arrives.
- **Don't re-add React `overrides` to `pnpm-workspace.yaml`.** They were there
  for months but never applied (pnpm only reads them from that file since 10.5,
  and `packageManager` was pinned to pnpm 9 — the lockfile had no `overrides:`
  block, which proved it). What keeps each app on its own React types is the
  `paths` entries in the web and CMS `tsconfig.json`. A repo-wide `react`
  override would force one exact React version on every app, but each app pins
  its own: Expo pins React to the SDK (19.3.0 on SDK 58, must match React
  Native exactly), Next and Payload pin theirs (19.2.x).
- **pnpm 11+ needs an `.npmrc` migration first.** From pnpm 11, `.npmrc` may only
  hold auth/registry settings; everything else must move to
  `pnpm-workspace.yaml`. Ours carries `shamefully-hoist=true` and
  `public-hoist-pattern[]`, which are load-bearing for Payload resolution and
  tied to the React-types workaround — so that upgrade is its own task, not a
  version bump.
- **Clerk middleware matcher — don't re-add the file-extension exclusion.**
  Clerk's boilerplate matcher skips paths ending in `.ico`, `.png`, `.css`… on
  the assumption they're static files. This app has **no `public/` directory**,
  so such a path is never a real file: it falls through to the top-level
  `[category]` route, whose layout calls `auth()`, which throws when the
  middleware didn't run. That produced a **500 on every browser's automatic
  `/favicon.ico` request** — one Sentry event per visitor, and the free tier is
  5 000/month. Found by Sentry within hours of switching it on. The matcher now
  excludes only `_next`, `_vercel` and `monitoring`.
- **App icons live in `apps/web/src/app/`** (`favicon.ico`, `icon.png`,
  `apple-icon.png`), generated by `apps/web/scripts/generate-icons.py`
  (`python3 apps/web/scripts/generate-icons.py`, needs Pillow). Regenerate rather
  than hand-editing, so every size stays consistent.
- **React types / `shamefully-hoist`:** the repo's `.npmrc` flattens deps into
  the root `node_modules`, so the mobile app's `@types/react@18` lands at
  `node_modules/@types/react` and `tsc` would pick it up for web/cms (React 19),
  causing bogus "Suspense/ClerkProvider cannot be used as a JSX component" and
  "bigint not assignable to ReactNode" errors. Fixed by `paths` overrides in
  `apps/web/tsconfig.json` and `apps/cms/tsconfig.json` that pin `react` /
  `react-dom` type resolution to each app's own React 19 copy. Don't remove
  those `paths` entries.
