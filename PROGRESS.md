# Akavish — Progress Log

**The single source of truth for project status.** The README explains _what the
project is and how to run it_; this file tracks _what's done and what's left_.

- **[Done](#done)** — everything built so far, grouped by area.
- **[In progress / next up](#in-progress--next-up)** — what's active right now.
- **[Backlog](#backlog--everything-left-to-do)** — the full prioritized to-do
  list (pages, back-office, deployment, legal, mobile…).

Legend: ✅ done · 🚧 in progress · ⬜ not started ·
priorities **P1** (before launch) / **P2** (soon after) / **P3** (nice-to-have).

Last updated: **2026-11-06**.

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
| ✅     | Category pages `/[category]`          | news, leaks, reviews, esport, previews, conferences. Page 1 opens on the 4 newest whatever their date, in one row under « Latest » (since 2026-11-17, so a quiet section never starts on one lonely card), then the whole list by date, those 4 included: a heading per day while the section is busy (2+ a day on average: Today, Yesterday, then the date), per month otherwise (`autoUnit`), always per day for esport, per year for conferences. `lib/date-groups.ts`, tested |
| ✅     | Author pages `/author/[slug]`         | Profile (avatar, bio, twitter) + their published articles                           |
| ✅     | Game pages `/game/[slug]`             | Game metadata (landscape cover, consoles and genres as links into the library, developers / publishers linking their company page, one line per release: "Oct 6, 2026 · PC, Xbox Series", schema.org VideoGame) + coverage: articles whose `game` is it **or** that also cover it (`relatedGames`, e.g. conference recaps) |
| ✅     | Console pages `/platform/[slug]`      | 2026-11-18, 🟠 migration `20261118_154700_platforms_collection` (the 24 consoles and every game's links copied over, down copies them back). Consoles are CMS documents (*Platforms*): the scout creates a new one when the news names it (a PS6 reveal, a game announced on it), first in its family. The page: its release, its games coming (soonest first, 20) and its latest releases (10), a link to the library filtered on it, then the news: articles with its tag (`Platforms.tag`, linked by the migration: PC, PS5, Nintendo Switch 2, Nintendo Switch, Xbox → Xbox Series) and, while it has 30 games or fewer, articles about one of them. In the sitemap. e2e in `public.e2e.spec.ts`. **How readers get there** (same day, from Alex: "how do you reach it?"): the game page's console chips (green, like links) and its release line; the "Consoles" row on `/games` and a "PS5 page →" link when the library is filtered on a console; the search (header suggestions and `/search`: consoles and studios the query names come first, `lib/entity-match.ts`); an article's tag chip that stands for a console or a studio ("PS5", "Rockstar Games") opens that page instead of the tag page, and the tag page links to it (`fetchTagPages`). Company names on game pages are green links too |
| ✅     | Company pages `/company/[slug]`       | 2026-11-17. A studio or publisher: its games (role, first release, consoles), then the news: articles about its games or tagged with it (`Companies.tag`), paginated like the tag pages (`?page=N` → `/page/N`). schema.org Organization |
| ✅     | Tag pages `/tag/[slug]`               | Articles filtered by tag                                                            |
| ✅     | Cross-links                           | Article byline → author/game; tag chips → tag pages                                 |
| ✅     | Custom 404 / error pages              | `not-found.tsx`, `error.tsx`, `global-error.tsx`                                    |
| ✅     | Functional footer                     | Sections, About/Contact/Legal, RSS, socials — all targets now exist                 |
| ✅     | Footer pages                          | `/about`, `/contact`, plus the legal set below                                       |
| ✅     | Legal pages (EN + FR)                 | `/privacy`, `/terms`, `/legal`, in French at `/fr/privacy`, `/fr/terms`, `/fr/legal` (the old `/fr/confidentialite`, `/fr/conditions`, `/fr/mentions-legales` 308 there since the i18n branch). Both texts are written by hand (`en.tsx` / `fr.tsx` next to each `page.tsx`). Facts (processors, publisher, date) live once in `lib/legal.ts` |
| ✅     | RSS feeds                             | `/feed.xml` (English) and `/fr/feed.xml` (French, translated articles only, since 2026-11-16), latest 50 published articles (`lib/feed.ts`); `<link rel="alternate">` on the home |
| ✅     | Loading states                        | Home only (`app/(home)/loading.tsx`). The other routes dropped theirs on 2026-11-07 so `notFound()` and slug redirects answer real 404/308 statuses (see gotchas) |
| ✅     | `next/image` everywhere               | Replaced raw `<img>`; media URLs absolutised; CMS host allowed via `remotePatterns`. Since 2026-11-18 without Vercel's optimizer (`unoptimized`): each image is a size Payload made at upload (see gotchas) |
| ✅     | `tsconfig` baseUrl fix                | `@/*` alias now resolves reliably at build                                          |
| ✅     | Article page polish                   | Reading time (`lib/reading-time.ts`), share row (`ShareButtons`), "Read next" suggestions and prev/next nav (`fetchRelatedArticles` / `fetchAdjacentArticles`) |
| ✅     | Share targets                         | X, Reddit, Bluesky, WhatsApp + copy link, plus the **Web Share API** sheet where supported. No Discord/Messenger buttons on purpose: Discord has no web share intent, and Messenger's Send Dialog needs a Facebook App ID and doesn't work on mobile — the native sheet covers both |

### SEO

| Status | Item                         | Notes                                                                                      |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------ |
| ✅     | Site config + `metadataBase` | `lib/site.ts` reads `NEXT_PUBLIC_SITE_URL`; layout sets metadataBase + default canonical   |
| ✅     | `sitemap.xml`                | `app/sitemap.ts` — static pages + categories + published articles, the authors/tags that have at least one published article (empty taxonomy pages are thin content), and every game and company page (the library: each has its facts) |
| ✅     | `robots.txt`                 | `app/robots.ts` — allows all but `/api`, `/account`, `/sign-in`, `/sign-up`; links both sitemaps |
| ✅     | Google News sitemap          | 2026-11-18. `/news-sitemap.xml` (`lib/news-sitemap.ts`, tested): articles of the last 48 hours in Google News format (`news:` namespace, publication Akavish, language, date, title), English and, once translated, French; refreshed every 5 min. Plus `max-image-preview:large` / full snippets for Google (News, Discover), and `NewsArticle` with the author's page, the publisher's URL and logo, `isAccessibleForFree` |
| ✅     | Canonical URLs               | `alternates.canonical` on home, article, category, author, game, tag                       |
| ✅     | CMS `seo` fields used        | Article metadata prefers `seo.title` / `seo.description`, falls back to title/excerpt      |
| ✅     | Dynamic OG images            | Shared design in `lib/og.tsx`; site default + article, category, author, game, tag routes   |
| ✅     | JSON-LD                      | `NewsArticle` on article pages (incl. `wordCount` + `timeRequired`) + `BreadcrumbList` on every detail page. Rendered through `components/JsonLd.tsx`, which escapes `<` |

### Search (Meilisearch)

| Status | Item            | Notes                                                                                                               |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| ✅     | CMS indexing    | `meilisearch` client + `afterChange`/`afterDelete` hooks on Articles (published → upsert, else remove); best-effort |
| ✅     | Backfill script | `pnpm reindex:search` (CMS) re-creates index settings + indexes all published articles                              |
| ✅     | Search API      | `app/api/search/route.ts` proxies queries server-side; key never exposed                                            |
| ✅     | CMS fallback    | No Meilisearch (or Meilisearch down/unindexed) → `/api/search` queries the CMS instead (Postgres `ILIKE` on title, excerpt, game name and tag names). Search never hard-fails; the response's `engine` field says which backend answered |
| ✅     | Search UI       | Header `SearchBar` + `/search` results page (robots: noindex)                                                       |
| ✅     | Search polish   | 2026-11-13 — the header suggests as you type (games, then 5 articles, then "See all results"; ARIA combobox, arrow keys), `/search` highlights matches, filters by section (chips with counts) and game, pages by 20, shows covers and dates. `/api/search` limit raised to 60/min for the suggestions (Vercel Firewall rule too) |
| ✅     | Local infra     | `docker-compose.yml` runs Meilisearch on :7700; env wired in both `.env.example`                                    |

## Auth

| Status | Item                             | Notes                                                              |
| ------ | -------------------------------- | ------------------------------------------------------------------ |
| ✅     | Clerk for readers (web)          | `ClerkProvider`, middleware, header Log in / Sign up, `UserButton` |
| ✅     | Sign-in / sign-up pages          | `/sign-in`, `/sign-up` (+ modal mode in header)                    |
| ✅     | Editor auth                      | Stays on Payload (CMS admin), separate from readers                |
| ✅     | Reader area `/account`           | 2026-11-13 — name, avatar, email, role badge, "Manage account" (Clerk's profile) and sign out, saved articles (12 a page, Remove). Linked from the avatar menu ("Saved articles"). Personal: no cache, noindex |
| ✅     | Saved articles                   | 2026-11-13 — **Save** on every article page (signed out it opens sign-in), `/api/bookmarks` (reader from Clerk's `auth()`, 60/min, `private, no-store`, same-origin only) → CMS `bookmarks`. Published articles only; an unpublished or deleted one drops off |
| ✅     | Followed games                   | 2026-11-18, 🟠 migration `20261118_085243_game_follows` (additive). **Follow** next to a game's name on its page (star; signed out it opens sign-in), `/api/follows` (same rules as `/api/bookmarks`) → CMS `game-follows` (unique per reader and game, 200 at most). `/account` shows the followed games, then the 6 latest articles about them (main game or *Also covers*), then the saved articles; the avatar menu links both (`#games`, `#saved`). A deleted game or reader takes its follows with it; `/privacy` (EN / FR) lists followed games among the data kept |
| ✅     | Sync Clerk users → CMS           | 2026-11-13 — `readers` collection, one row per Clerk account, created on the first visit to `/account` or first Save (`READER_API_SECRET`, server to server) and kept in sync by Clerk's webhook (`/api/clerk/webhook`, Svix signature): deleting the account deletes the reader and their saved articles. `DEPLOYMENT.md` §6.5b |
| ✅     | Reader roles and badges          | 2026-11-13 — Owner (one account only), Admin, Mod, Author, Reader, set by an admin in `/admin` → Readers. A reader whose verified email is a CMS user's is linked to it and its author profile and shown as Author. Badge on `/account` and next to the name on comments |
| ✅     | Comments                         | 2026-11-13 — under every article (`components/Comments.tsx`, CMS `src/lib/comments.ts`). Verified, unbanned readers only; plain text, 2,000 characters, no images, links stay text; threads one level deep with "Replying to @name"; like / dislike (not your own), top comments by likes then oldest, replies oldest first; no editing, delete your own (a comment with replies stays as "Comment deleted"); Owner / Admin / Mod readers hide, restore and delete anyone's. Anti-spam: one every 30 s, 30 a day, no duplicates, accounts under 10 minutes old wait. **Report** (spam, harassment, illegal, other + note): once per reader, goes to `/admin` → Community → Reports and to a private Discord moderation channel (`MODERATION_DISCORD_WEBHOOK_URL`); 3 reports from different readers hide the comment until a moderator restores it. Switches: `/admin` → Community settings → *Comments on* (everything, at once) and *Comments closed* per article. Public name = Clerk username (required at sign-up since 2026-11-13). Terms (community rules, reporting) and privacy, EN + FR, and Discord added to the processors. `DEPLOYMENT.md` §6.5c. **Tested end to end in production by Alex on 2026-11-14** with two accounts (Owner + reader): posting and pacing, duplicates, replies and "Replying to", likes and sorting, report to Discord and /admin, auto-hide, hide / restore / delete, "Comment deleted", the switches and a ban |
| ✅     | Editorial roles                  | 2026-11-13 — CMS users are admin / editor / writer (`apps/cms/src/access/roles.ts`): writers draft under their own author profile (Users → *Author profile*), can't publish, can't edit published or others' articles; editors publish anything; admins also manage users, subscribers and readers. Existing accounts became admins |

## Mobile (Expo)

| Status | Item                        | Notes                         |
| ------ | --------------------------- | ----------------------------- |
| ✅     | Expo app consuming same API | Shares `api-client` + `types` |
| ✅     | Reading app                 | 2026-11-09: tabs Home / News / Leaks / Reviews / Sections, article screen, every section, pull-to-refresh, infinite scroll, share. Validated on an iPhone in Expo Go. Details in §7 |
| ⬜     | Clerk on mobile             | Parked with the app: see §7 "Catch up with the website" |
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
| ✅     | Build job             | `pnpm build` (web + CMS) with a Postgres service + dummy env, then migrations from scratch, `pnpm seed`, CMS integration tests and a Playwright admin pass |
| ✅     | ESLint flat configs   | web + cms use `eslint.config.mjs` importing `eslint-config-next`'s native flat presets (no FlatCompat, no `next lint`); web bumped to `eslint-config-next@16` |
| ✅     | Link hygiene          | Internal `<a>` → `next/link` `<Link>` across web (fixes `no-html-link-for-pages`)                                                                             |
| ✅     | `type-check` scripts  | Added to root (turbo) and CMS                                                                                                                                 |
| ✅     | CI runtime hygiene    | GitHub Actions uses Node 22 LTS plus Node-24-compatible action runtimes (`checkout@v7`, `setup-node@v7`, `pnpm/action-setup@v6.1.1`, kept current by Dependabot)                        |
| ✅     | Workspace dependency hygiene | `@akavish/ui` explicitly declares its `@akavish/types` workspace dependency, so isolated CI installs resolve it correctly                              |
| ✅     | API client type environment | `@akavish/api-client` explicitly includes DOM fetch types and Node 22 process types, so isolated CI type-checks match its web/Expo runtime contract     |
| ✅     | Security cleanup      | 2026-11-06: 298 Dependabot alerts (30 critical) → 5 low/moderate in build-only tooling. Next (web 15.5.29, CMS 16.4.5), Payload 3.93.0 (+ migration `payload_3_93`), Sentry 10.78, sharp 0.35.5, vitest 4.1.12; unused `jsdom` / `@vitejs/plugin-react` removed from the CMS; transitive fixes pinned in `pnpm-workspace.yaml` `overrides` |
| ✅     | Next 16 + Sentry 11   | 2026-11-16 (Dependabot #4, #2): web on Next 16.4.6 like the CMS, built with Turbopack. `middleware.ts` → `proxy.ts` (same `clerkMiddleware()`), `next/image` `priority` → `preload`, and `/api/revalidate` calls `revalidateTag(tag, { expire: 0 })` so a CMS change still drops the cache at once (the new `'max'` profile would serve stale once more). Sentry 11 on both apps: `withSentryConfig` imported from `@sentry/nextjs/config`, `disableLogger` → `bundleSizeOptimizations.excludeDebugStatements`; `dataCollection` unchanged. Checked with the full CI sequence locally, both Playwright suites included |
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
| 3   | ✅ **Custom domain + email**        | Live on `akavish.gg` (web, Vercel) + `cms.akavish.gg` (Railway), DNS on Cloudflare, DNSSEC on, env vars swapped, `www` 308s to the apex, and `hello@`/`tips@`/`privacy@` forward via Cloudflare Email Routing. Clerk production instance live since 2026-11-10, Google / Discord / Twitch sign-in since 2026-11-11, X off until the X API is paid (`DEPLOYMENT.md` §6.5) | —      |
| 4   | ✅ **Email adapter**                | Done — `@payloadcms/email-resend` wired in `payload.config.ts`; password resets are really sent, with a branded HTML template (`lib/emails/forgot-password.ts`). Off when `RESEND_API_KEY` is unset (console fallback). Setup + DNS in `DEPLOYMENT.md` §4c | —      |
| 5   | ✅ **Search works in prod**         | Done — `/api/search` falls back to the CMS (Postgres `ILIKE`) when Meilisearch isn't configured, and when it errors. The header search box was returning 503 on every page; now it works for free. `DEPLOYMENT.md` §4 | —      |
| 6   | ✅ **Article page polish**          | Done — reading time (+ `wordCount`/`timeRequired` in the JSON-LD), share row, "Read next" suggestions, prev/next nav. Suggestions fail soft: a CMS error drops them instead of breaking the page | —      |
| 7   | ✅ **Observability**                | Done — Vercel Web Analytics (cookieless, 50k events/mo free) + Sentry errors & tracing on web and CMS. Both no-op without config. `DEPLOYMENT.md` §4d | —      |
| 8   | ✅ **Legal pages**                  | Done — real `/privacy`, `/terms`, `/legal` (LCEN notice) in EN + FR, written from the actual processor list (`lib/legal.ts`). Sentry PII collection explicitly disabled so the policy is true. **Not reviewed by a lawyer** | —      |
| 9   | ✅ **Homepage layout**              | Done — masthead with real section links, lead story + "Top stories" column, one section per category. Since 2026-11-11 the sections include the lead and top stories too (a big story still shows in its own category; `sectionArticles` in `lib/home.ts`). Since 2026-11-17: 4 top stories, and each section shows its own 4 latest in one row whatever their date (fetched per category, so Reviews isn't down to the one review among the 24 newest articles). Degrades cleanly down to one article or an empty state. Skeleton in `loading.tsx` mirrors it | —      |
| 10  | ✅ **Reader-facing fallbacks**      | Done — the home and category pages showed developer instructions to the public ("Make sure the CMS is running on localhost:3001", "Publish an article in the CMS"). Now `components/StatusMessage.tsx` | —      |
| 11  | ✅ **Secret-rotation runbook**      | Done — `DEPLOYMENT.md` §8, written after the October 2026 Railway incident: inventory, order of operations, pitfalls, rotation log | —      |
| 12  | ✅ **Expo SDK upgrade**             | Done — SDK 52 → 58 (React 19.3, RN 0.88), validated on an iPhone in Expo Go. Mobile is back in CI lint + type-check. Details in §7 | —      |
| 13  | ✅ **Nightly DB backups**           | Done — `.github/workflows/backup.yml`: `pg_dump` of prod → **private** R2 bucket, 30-day lifecycle. Set up and verified on 2026-11-05 (first manual run uploaded to `akavish-backups/db/`); restore drill passed on 2026-11-06; healthchecks.io emails if a night's backup never runs; since GitHub's cron runs hours late, a Cloudflare Worker (`infra/backup-trigger/`) triggers it on time — `DEPLOYMENT.md` §9 | —      |
| 14  | ✅ **Slug redirects**               | Done — renaming a published article records the old slug (`previousSlugs`); old URLs 308 to the new one | —      |
| 15  | ✅ **Unit tests**                   | Done — vitest on the shared Payload mapper, reading time and the web ↔ CMS category list; `pnpm test`, run in CI | —      |
| 16  | ✅ **Share images everywhere**      | Done — one design (`lib/og.tsx`) for a site-wide default plus category, author, game and tag pages. Fixed the wordmark rendering as "Akav ish" | —      |
| 17  | ✅ **Local dev DB in Docker**       | Done — the Neon dev project and the Railway dev environment were deleted; local dev uses Postgres from `docker-compose.yml` | —      |
| 18  | ✅ **Seed script**                  | Done — `pnpm seed`: admin (only on an empty DB) + 8 fictional articles across all 6 categories, with author, games, tags and generated covers. Re-runnable, refuses any non-localhost `DATABASE_URL` | —      |
| 19  | ✅ **Uptime monitoring**            | Done — UptimeRobot (free, every 5 min, email alerts): HTTP probe on `akavish.gg`, Keyword probe on the CMS REST API so a DB outage counts too. Payload 404s on `HEAD`, hence Keyword, not HTTP — `DEPLOYMENT.md` §4d | —      |
| 20  | ✅ **Mobile + accessibility audit** | Done (2026-11-06) — axe-core (WCAG 2.1 AA) + iPhone 13/desktop pass on every page type, then fixed: contrast (no `text-zinc-500/600` for small text, darker Sign-up green), a swipeable section strip under the header on phones, underlined prose links, `lang="fr"` on the French pages, real cover alt text from the CMS (`coverImageAlt`) and empty alt on cards, skip link, heading order, 24 px tap targets in the footer, reduced-motion scrolling. Re-audit: 0 axe violations except the decorative 404 numeral | —      |

> **Sending vs receiving — two different things, both now in place.** Resend
> (task 4) **sends** Payload's password resets from `mail.akavish.gg`. Cloudflare
> Email Routing (task 3) only **receives**, forwarding `hello@`/`tips@`/`privacy@`
> to a personal inbox. Neither can do the other's job.

**The "do now" list is done** (#1–#20), and so is everything that could be done
without waiting (CMS tests in CI, Dependabot, previews, Docker, breadcrumbs,
homepage `featured`, contributor docs, security cleanup — 2026-11-06; light
theme, public-site e2e tests, scheduled publishing, pagination — 2026-11-07;
mobile reading app, newsletter sign-up — 2026-11-09).

**Clerk is in production since 2026-11-10** (`pk_live_…` on `akavish.gg`,
Frontend API on `clerk.akavish.gg`), with Google, Discord and Twitch sign-in
on Akavish's own OAuth apps since 2026-11-11. X sign-in is **switched off**
(credentials kept in Clerk): switch it back on when the paid X API plan is
taken, the same plan the scout's step 3 needs — `DEPLOYMENT.md` §6.5.

**In progress: the AI news scout** (section below). Steps 1 (observation) and
2 (drafts + Discord buttons) are live in production since 2026-11-10, bot set
up, whole Discord flow tested by hand on 2026-11-11 (draft, V2, Reject,
Publish). Drafts carry a cover and the official videos since 2026-11-11.

**Instant site refresh** (2026-11-11): the CMS pings `/api/revalidate` after
every public change, so a new article shows on its category page at the first
reload instead of after 30 s and a few reloads. Needs `REVALIDATE_SECRET`
(same value) on Railway and Vercel — `DEPLOYMENT.md` §4e. **Targeted since
2026-11-19:** the ping carries cache tags (the article, the lists, its games,
tags, author, studios and consoles) and only those pages rebuild; the timers
went from 30 s to 5 min (home, sections) and 1 h (everything else). The full
flush on every scout save cost ~15K Vercel ISR writes a day. **Automatic drafts are on since 2026-11-11** (threshold 60, at most 25 a
day since Nov 20), a few days ahead of the plan; the weekend review (Nov 14-15) tunes
them, so they're ready for GTA VI on Thursday Nov 19.

Everything else waits on something:

| Waits on | Items (in the backlog below) |
| --- | --- |
| **The app being shipped** | Push notifications · store release (EAS) · app store assets · universal links |
| **Traffic** | Hosted Meilisearch |
| **Content and readers** | Everything in **🅿️ Parked**: sending the newsletter, analytics review |
| **Money / launch** | Legal review by a professional (before monetising) |

**The French version (i18n)** went live on 2026-11-16: interface, French
article translations on publish, backfill of the old ones. Plan and status in
§6.

> **The real bottleneck is content, not code.** The production CMS had zero
> articles from October 2026 until the launch batch: 11 AI-assisted articles
> (4 on GTA VI, plus Worlds, Valorant, the CS2 Major, PS Plus, the releases
> left in 2026, the 2026 review and 2027), posted with
> `apps/cms/scripts/publish-articles.mjs` on Nov 10: 6 live, 5 scheduled until Nov 16
> so the site isn't empty for GTA VI. A 12th, "GTA VI is out" (unlock times by
> region, official sources), is scheduled for Nov 18 at 11:00 UTC, the moment
> New Zealand hits midnight, and already ticked `featured`: it takes the lead
> on its own when it goes live. On Nov 11 every article (live, scheduled and
> the first scout ones) was completed: tags, game (Marathon added to *Games*),
> cover alt text, publishers, and covers for the CS2, League of Legends and
> Marathon game pages (Valorant's from the official key art Alex supplied). Drafts and sources:
> [Akavish : articles de lancement](https://claude.ai/artifact/7xqDrjALBdwL33reFUC6jf).
> On Nov 12, Alex's 33 old conference write-ups (PDFs in the gitignored
> `import-docs/`, 2022 to 2026: Xbox, PlayStation, Nintendo, Ubisoft, Summer
> Game Fest, Gamescom ONL, The Game Awards, PC Gaming Show) became 33
> *Conference* articles, every announcement in show order with its official
> trailer link, backdated to the event (`publishedAt`) so they fill the
> archive without pushing the news down. Covers are trailer stills, no real
> people. Dead links and links that pointed to the wrong video in the PDFs
> were replaced with the right official trailers (one segment left without).
> The same day 190 game pages were created from them (developer, publisher,
> platforms, genre, release date when known, a trailer still as cover, none
> for the 6 whose only stills show a real person), each game name in the
> recaps links to its page, and every recap lists under all the games it
> covers (`relatedGames`). Also on Nov 12, Alex's own Steam reviews became
> 57 *Review* articles (the long ones, from 2023 to 2026), each linked to its
> game (44 game pages created), backdated to the day he posted it, with an
> official Steam screenshot as cover and his score (`score`, out of 10: the one
> written in the review, else his HowLongToBeat rating). His HowLongToBeat
> texts can't be fetched (the site forbids automated retrieval), so he saved
> them himself: 21 more reviews went live the same evening (PS5, Xbox, Switch
> and Switch 2 games, the short ones rewritten in full prose, the Returnal DLC
> folded into the Returnal review), with 15 new game pages and official
> screenshots or trailer stills as covers, each backdated to the day Alex
> finished the game (2020 to 2026). Total: 78 reviews. After that, the AI scout keeps the
> rhythm.

| Status | Item            | Notes                                                                                                                                            |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅     | **Media on R2** | Live — uploads go to Cloudflare R2 and are served from `media.akavish.gg` (custom domain, cached by Cloudflare); images now survive Railway redeploys. Setup documented in `DEPLOYMENT.md` §4b. |

---

# Maintenance (automated)

A scheduled Claude task runs twice a day (10:23 and 19:23, Paris time) on Alex's
Mac and does whatever is due, recorded in the gitignored
`.claude-maintenance.json` so a run missed because the Mac was off is caught up
by the next one:

- **Weekly** (from Monday): merge green Dependabot PRs (squash), investigate red
  ones, check CI on `main` and that a backup succeeded every day.
- **Monthly** (from the 2nd): security audit, fix new alerts, drop `overrides`
  pins no longer needed, re-check the tolerated alerts.
- **Every ~3 months:** remind Alex to run the restore drill (`DEPLOYMENT.md` §9).

---

# AI news scout (in progress)

**Design doc (validated by Alex, Nov 2026):**
[Akavish : scout IA (design)](https://claude.ai/artifact/RF8xyEFTqjg7MTR1Ud7j8w).
A bot inside the CMS that watches news and leak sources, groups what it reads
into stories, scores them, writes drafts and sends them to Alex on Discord.
**Nothing is published without his click.** Code: `apps/cms/src/scout/`, setup
and variables: `DEPLOYMENT.md` §11.

**Decisions:** articles in English (French with the bilingual project) ·
budget capped at 50 $/month (auto-pause + 80 % warning, 5 $/day, Anthropic
spend limit) · validation on Discord: Publish / Edit (free-text feedback → V2)
/ Reject · official sources read every 5 min, the rest every 15 · "maybe"
lists at 8 am and 8 pm Paris · esport at launch: CS2, LoL, Valorant, Rocket
League (R6 next; Fortnite, Dota 2, Overwatch, PUBG as news only) · no Reddit
(commercial use needs Reddit's written agreement) · the scout always says who
it is (no browser User-Agent, a feed that refuses it gets unticked).

| Step | Status | What |
| --- | --- | --- |
| 0. Prerequisites | ✅ 2026-11-10 | Anthropic key with spend limit, private Discord channel + webhook, Discord bot (Interactions Endpoint saved) |
| 1. Observation | ✅ live 2026-11-10 | 38 RSS feeds (all `ok` / `not modified` in production on day 1, none refused), grouping + score (Haiku), digests at 8 am / 8 pm, budget caps, weekly report on Saturdays + `/api/scout/report` (2026-11-10) |
| 2. Drafts + validation | ✅ live 2026-11-10, automatic drafts **on** since 2026-11-11 (threshold 60, 20/day) | Sonnet drafts in the CMS (draft, `aiAssisted`), Discord bot with Publish / Edit (→ V2 as a reply) / Reject, "Rédiger…" menu under each digest. Switch: `draftsEnabled` in Scout settings. **Media** (2026-11-11): a cover on every draft (official source's `og:image`, else the game's cover, never a press outlet's image), official YouTube videos in a *Watch* section, an image URL field in *Modifier*, Publish refused without a cover. **Tags and game** (2026-11-11, reworked the same evening after wrong picks): 2 to 5 tags in a set order (company, platforms, theme), existing ones plus at most 2 created; the game only when the story is about it, created when missing; both cleaned up on a rejection; cover alt text from the publisher's `og:image:alt`. **Duplicates** (2026-11-11): a Haiku check skips automatic drafts of news already covered or recently rejected. **Scores and grouping** (2026-11-12, from the editor's review of a digest): new weights (significance ×0.6, +5 per outlet, official 25 / outlet 15), a richer significance guide, the triage sees 3 days of stories that matter instead of the last few hours, and items repeating an Akavish article are set aside before they become stories. Field by field: `DEPLOYMENT.md` §11 **Games library** (2026-11-17): every draft lists `game_facts`, the official dates, consoles and studios its sources give for each game (the story's, and every game of a lineup or showcase; never from a rumour). The card shows what Publish will change (🎮 Fiches jeux); on *Publier* they're merged into the games (`scout/game-facts.ts`, `mergeReleases`: per console the news wins, a vaguer date that agrees changes nothing, a new console adds a row), new games are created, studios / publishers become Companies, and the games dated go in *Also covers*. A showcase recap does the same on *Publier le résumé*. **Category** (2026-11-18): the scout never files under Reviews or Previews (the editor's own, with a score); other outlets' reviews and Metacritic are News, forced in `cleanDraft` after three GTA VI review roundups went to Reviews (moved back to News by hand). |
| 3. Leakers + style | Later | X accounts (pay-per-use API; when it's paid, also switch X sign-in back on in Clerk, `DEPLOYMENT.md` §6.5), learning from published / rejected drafts. Then **leaker pages** (idea from a reader, 2026-11-16): one page per leaker with their claims and how each turned out (confirmed, wrong, pending), and their track record feeding the reliability of their next leaks in the score. Needs real leakers followed first |
| 4. Esport | Later | Daily recaps and big tournaments, once the results source is chosen. First: compare Liquipedia (free, strict terms of use, limited API) and PandaScore (paid pro API) on CS2, LoL, Valorant, Rocket League coverage, price and terms, and pick one |
| 5. Event mode | ✅ built 2026-11-12 (migration `scout_events`), first real use at The Game Awards (Dec 10, 2026, 5 pm PT = 2 am Paris on the 11th). **Rehearsal mode** 2026-11-18 (🟠 migration `live_rehearsal`; first rehearsal on production the same day: cards, publish, undo, stop, recap all fine; fixed after it: a console the site doesn't know, like a PS6, is now created as a console page and linked (see *Console pages*), and a family alone keeps the date without consoles instead of leaving "PC" alone, and the recap names each game under one heading only): `/live start … test:True` runs every step for real (Sonnet, cards, Publier, undo, stop, recap) but its articles stay drafts, it creates or changes no game, and *Supprimer la répétition* deletes what it made. **To do before The Game Awards: a rehearsal on production** (`DEPLOYMENT.md` §11, *Rehearsal*) | `/live start <name> [image]`, `/live add <text + links>` (or `#3 …` to correct or complete entry 3), `/live image`, `/live stop`, `/live status` on Discord. One live article, short entries newest first (headline, one or two sentences, trailer and official links, link to the game's page), updated every 5 min from the editor's notes and the feeds, repeats merged, entries completed as new facts come in, new games get their page. First version validated by "Publier le live", then updates go live by themselves with "Annuler cette MAJ". On stop: "the show is over" and a recap article drafted for validation, its card listing what *Publier le résumé* will change in the games library (🎮 Fiches jeux). Live and recap calls check the monthly budget only (the daily cap, shared with drafts and translations, must not stop a show); a failed update is retried on the next run and posted on Discord (once per error per half hour). Discord split into channels (2026-11-18, `DEPLOYMENT.md` §11): `#scout-news` (digests, drafts, V2), `#scout-conferences` (everything `/live`, `SCOUT_DISCORD_LIVE_CHANNEL_ID`), `#scout-alert-budget` (`SCOUT_DISCORD_BUDGET_CHANNEL_ID`), `#scout-weekly-report` (weekly report, `SCOUT_DISCORD_REPORT_CHANNEL_ID`), `#moderation` (comment reports, its own webhook); an unset channel falls back to `#scout-news`. `DEPLOYMENT.md` §11 |

**Timeline to GTA VI (Thu Nov 19):**

- ✅ Nov 10: step 1 and step 2 live, bot set up, default author *Akavish*,
  feed statuses checked (all fine).
- ✅ Nov 10-11: the whole chain tested by hand from the "Rédiger…" menu: a
  draft, a *Modifier* (V2 as a reply), *Rejeter*, and *Publier* on a real
  story (Fairgames, its cover added in `/admin` afterwards). Fixed on the way:
  Sonnet 5.5 refusing forced tool calls, drafts without images (now a cover
  and official videos on every draft), category pages slow to refresh
  (on-demand revalidation, `REVALIDATE_SECRET` set on both apps).
- Nov 12-14: digests only. Note the stories that should have scored higher or
  lower. Draft one story with an official source (ideally a trailer) to see the
  new media on a real case: cover and its origin on the card, *Watch* links,
  *Modifier* with an image URL only.
- Nov 14 (after the Worlds final): update the Worlds article (id 9) with the
  result.
- Nov 14-15: review, from the weekly report (Discord, Saturday 8 am, or
  `cms.akavish.gg/api/scout/report`): stories per day at each threshold,
  score spread, cost, and how many automatic drafts were published or
  rejected. Already noted: the grouping split one story in two (Fairgames at
  80 and 76), and many single-source stories score 33. Tune the threshold and
  `maxDraftsPerDay`. Done early on Nov 13 from Alex's review of the day:
  +8 per extra outlet (cap 24) instead of +5 (cap 20), since news carried by
  3-5 outlets sat at 55-57 all day and was never drafted; the triage guide
  ranks big esport playoffs and finals with a top team, star statements and
  top-team roster changes at 60-75 (routine matches stay below 40); every run
  rescores the last 24 h of stories so the change applied at once. Esport
  results proper wait for step 4 (daily recaps, not one article per match).
  ✅ Nov 14, review done (weekly report + a backtest of the week's 1,175
  stories against Alex's decisions: 40 drafts, 31 published, 9 rejected, 1.49 $
  for the week). "V3": outlets not feeds (IGN France = IGN), outlet bonus
  only from significance 40 (blocks widely relayed minor news), HLTV and
  VLR.gg official for esport, esport drafts from 50. Halving platform sites
  (Push Square, Pure Xbox, Nintendo Life) was tried and dropped: it cost two
  drafts Alex liked. The 6 "Doublon" rejections were all drafted on Nov 11
  before the duplicate check went live (17:32 UTC); none since, and it set 3
  aside by itself. Threshold stays 60, `maxDraftsPerDay` 20 (a busy day is
  18-20 at or above it). Same day, from Alex: the Nvidia CEO investigation
  (5 outlets) should have been drafted; the model had rated it 35, "not about
  games". The triage guide now ranks high-profile stories about the leaders
  and big companies of games and gaming hardware (CEO scandals, lawsuits,
  regulators, bosses leaving, console and GPU prices) at 60-75, rather than
  loosening the significance-40 rule.
- ✅ Nov 16, running-in check (since V3 on Nov 14): 8 drafts, 7 published,
  1 rejected by Alex ("Pas pertinent"), none needing a V2, all with a cover,
  about 0.25 $ a day. Quiet weekend: 8 of 107 new stories at 60 or more. But
  the duplicate check set aside 10 stories, and 5 of them wrongly: its own
  reason said "new event, not a duplicate" while it still gave the closest
  article's id (FURIA winning the BLAST Rivals final, BLG winning Worlds,
  two semifinals and a live, all against the article on an earlier match or
  the preview). Fixed: the answer now has an explicit `is_duplicate`, reason
  first, and only `true` sets a story aside; the guide says another match or
  the result of a previewed event is new news. Near miss to watch: "Jensen
  Huang weighing a return as Nvidia CEO" at 57.
- ✅ Nov 16, from a reader: in release lists, a bold "February 4: Metro 2039"
  read badly. Lists now start with the game in bold, then " · " and the short
  date ("**Metro 2039** · Feb 4"); the two articles concerned (2027, rest of
  2026) were fixed in place, the draft prompt asks for it and `toLexical`
  turns a leading `**Name**` of a list item into bold. Dates stay in English
  formats until the French version (i18n).
- ✅ Nov 11: `draftsEnabled` ticked (threshold 60, `maxDraftsPerDay` 20).
- Nov 11-18: running-in with automatic drafts.
- ✅ Launch article ready (Nov 11): "GTA VI is out" (id 20), scheduled for
  Nov 18, 11:00 UTC (midnight in New Zealand, the first unlock; Rockstar:
  "midnight local time … in all regions"), `featured` already ticked so it
  becomes the lead by itself.
- ✅ Nov 18-19: `maxDraftsPerDay` to 40 for launch day, back to **25** on
  Nov 20. `featured` unticked on "GTA VI: everything we know" (id 5).

**AI transparency:** articles drafted by the scout carry `aiAssisted`, which
shows a one-line note under the article (web and app): "Researched and drafted
with AI assistance, then fact-checked, edited and approved by an Akavish
editor, who is responsible for it." Untick it if you rewrite the piece
yourself. Never claim a scout draft is human-written. `/terms` and
`/fr/conditions` say drafts may be AI-assisted and are always approved by a
human (EU AI Act art. 50).

---

# 🅿️ Parked — good ideas, deliberately not now

Kept here so they aren't lost. Each one only pays off with **content and
readers**, which the site doesn't have yet — revisit once publishing is regular.

| Idea | Why it waits / what it depends on |
| --- | --- |
| Newsletter: the digest | Sign-ups are live since 2026-11-09 (see §1); what waits is **sending** issues: a digest template with the per-subscriber unsubscribe link (`unsubscribeUrl(id)` in `apps/cms/src/lib/newsletter.ts`) and a `List-Unsubscribe` header, sent to `status: confirmed` only. Resend's free tier is 100 emails/day, so a list past ~100 needs its paid plan or batched sends. The AI scout can feed it Also: the confirmation email and the issues in the subscriber's language (French sign-ups from /fr), since the site is bilingual (2026-11-16). |
| Analytics review | Vercel Analytics is collecting; reading it means something once there's traffic |
| Google Reader Revenue Manager | Google's paywall / contributions / newsletter sign-up tool (Publisher Center). Not used: its snippet (`swg-basic.js` on every article) adds a Google script and its cookies, so it needs a consent banner and a privacy update first. Only if Akavish ever charges for content or asks for contributions (2026-11-18) |

---

# Backlog — everything left to do

Grouped by area. Rough priority: **P1** = needed before a public launch ·
**P2** = strongly wanted soon after · **P3** = nice-to-have / later.

## 1. Website (public frontend — `apps/web`)

### Pages & navigation

| Pri | Item                         | Notes                                                                                       |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| ✅  | Newsletter sign-up           | Done (2026-11-09). Form in the footer of every page and at the end of articles: email + unticked consent box + honeypot, `/api/newsletter` (5/min per IP) → CMS `/api/newsletter/subscribe`. **Double opt-in**: a confirmation email (`lib/emails/newsletter-confirm.ts`), nobody is subscribed until they click it (`/newsletter/confirm`). Same answer whether the address is new, pending or already in, so the form can't reveal who's subscribed; one confirmation email per address per 10 min. Unsubscribe (`/newsletter/unsubscribe`, asks for a click) **deletes** the row; unconfirmed sign-ups are deleted after 30 days. Confirm token stored hashed; unsubscribe links are HMAC-signed with `PAYLOAD_SECRET`. `subscribers` collection, admins can read (editors could until 2026-11-13), nobody can add. `/privacy` (EN + FR) and the processor list updated. Tested end to end in production on 2026-11-09 (real sign-up, confirmation email via Resend, confirmed in `/admin`). Sending issues: 🅿️ Parked |
| ✅  | Single article polish        | Done — reading time in the byline, share row (X/Reddit/Bluesky/WhatsApp + native share sheet + copy link), "Read next" suggestions and prev/next navigation |
| P2  | Auto-post each article on the socials | Asked 2026-11-23: every published article posts itself on Discord (public « actus » channel), X, Instagram, TikTok (Bluesky / Threads too if cheap): a short text written by the scout, the cover, the link to the article. Discord first (free, a bot or webhook we already have the pieces for). X: paid API (pay per post, `COSTS.md`). Instagram: a Business account linked to a Facebook page and Meta's API, links aren't clickable in a caption ("link in bio"). TikTok: its posting API needs an app review, photo posts or video. Check each platform's current rules when we build it |
| P3  | Leaker pages                 | One page per leaker (claims, confirmed / wrong / pending) and their record weighing on the score of their leaks. Comes after scout step 3 (real leakers followed) |
| P2  | Legal review by a professional | The pages are written and factually accurate, but **not reviewed by a lawyer**. Worth doing before monetising (affiliate/sponsored disclosures) or if traffic grows |
| ✅  | Homepage layout pass         | Done — lead story, top stories, per-category sections (see roadmap #9). "Trending" would need view counts, not available yet |
| ✅  | Dark/light toggle            | Done (2026-11-07) — follows the OS, sun/moon switch in the header remembers the choice (no flash on reload). Components keep the dark classes; the `@theme inline` block of `globals.css` (Tailwind 4 since 2026-11-23, `tailwind.config.ts` before) maps zinc/white/emerald text to CSS variables that flip there. axe-clean in both themes, header fits from 320 px |
| ✅  | Sections in the header        | Done (2026-11-12) — the section links show from 1024 px; below that the swipeable strip of every section (was phones only, the header overflowed between 640 and 1024 px). Since 2026-11-16 all six, in Alex's order: News, Leaks, Esport, Reviews, Previews, Conferences (`NAV_SECTIONS` in the layout, also the phone strip and the footer); tighter gaps between 1024 and 1280 px so French fits |
| ✅  | Games library | 2026-11-17, 🟠 migration `20261117_095500_games_library` (additive). `/games` is the site's encyclopedia: filter by console, year, month, studio or publisher, genre, out / upcoming, letter, name, A to Z or by date ("Switch in 2019", "PS5 in November 2027"), in the browser (`components/GamesLibrary.tsx`, logic in `lib/game-library.ts`, unit-tested), filters in the URL (shareable), the page stays cached (the query is read once mounted, not with `useSearchParams`), 60 cards then "Show more". Data: Games get **releases** (one row per group of consoles released together: consoles, date, precision day / month / quarter / year / TBA; a port is its own row) from which the hook derives `platforms` and the first `releaseDate` (+ `releaseDatePrecision`); consoles one by one (`lib/platforms.ts` in the CMS and the web, kept in sync by a test), no more families. Studios and publishers are **Companies** (`/company/<slug>`, aliases for former names, optional tag). Backfill of the 262 games: releases checked by Alex line by line (2026-11-17), companies normalised (Microsoft Studios → Xbox Game Studios…). The old `platform` / `developer` / `publisher` fields were dropped once the backfill was checked (🟠 migration `20261117_104444_drop_old_game_fields`, same day). The scout keeps the library up to date (see AI scout) |
| ✅  | Games page + games first in search | Done (2026-11-16) — `/games` (`/fr/games`): every game A to Z under letters, with a row to jump, cover + year, in the header after Conferences ("Games" / "Jeux"), the phone strip, the footer and the sitemap. The search finds games by name **and initials** ("GTA" → Grand Theft Auto VI, "cod" → Call of Duty, "gta 6", "cs2", roman numerals as numbers: `lib/game-match.ts`, unit-tested, matched in memory against all games, cached 5 min) and shows them first on `/search` (12 cards, page 1), then the articles; the articles about the 5 best-matching games count as results too, whatever their title. The home's masthead lost its section pills (the header has them all); home sections follow the header order (`lib/nav.ts`) |

### UX & quality

| Pri | Item                    | Notes                                                                    |
| --- | ----------------------- | ------------------------------------------------------------------------ |
| ✅  | Mobile responsive audit | Done — roadmap #20. Phones get a section strip under the header; no horizontal overflow on any page |
| ✅  | Accessibility pass      | Done — roadmap #20 (axe-core clean). Re-run the audit after big UI changes |
| ✅  | Analytics               | Vercel Web Analytics — cookieless, 50k events/month free, no consent banner needed. Enable it in the Vercel dashboard to start collecting |

## 2. SEO

Core SEO is done (see the [Done → SEO](#seo) section). Remaining:

| Pri | Item                            | Notes                                                     |
| --- | ------------------------------- | --------------------------------------------------------- |
| ✅  | OG images for non-article pages | Done — shared `lib/og.tsx`; default + category/author/game/tag |
| ✅  | Breadcrumb JSON-LD              | Done (2026-11-06) — `BreadcrumbList` on article (Home › Category › Article), category, author, game and tag pages (`lib/structured-data.ts`, unit-tested) |
| ✅  | Per-locale hreflang             | Done (2026-11-16) with the French version: every page lists its `en`, `fr` and `x-default` alternates, canonical per language, sitemap with both languages |
| ✅  | Google Search Console + Google News | Done 2026-11-18 by Alex (`DEPLOYMENT.md` §6.8): `akavish.gg` verified (Domain property), `/sitemap.xml` and `/news-sitemap.xml` read with *Success* on day 1, publication verified in the Publisher Center (logos: the app icon, and the wordmark on a dark tile). Next: watch *Pages* (indexing) in Search Console |

## 3. CMS / back-office (`apps/cms`)

### Content modeling

| Pri | Item                          | Notes                                                                          |
| --- | ----------------------------- | ------------------------------------------------------------------------------ |
| ✅  | Auto `publishedAt`            | `beforeChange` hook stamps the publish date; re-saving an undated published article backfills from `createdAt`. Fixes the missing byline date, JSON-LD `datePublished`, prev/next nav and `-publishedAt` sorting |
| ✅  | Required SEO defaults         | Already covered at render time: article metadata falls back to title/excerpt when the SEO fields are empty |
| ✅  | Homepage curation             | Done (2026-11-06) — `featured` checkbox on articles (migration `article_featured`): the newest featured article is the homepage lead, else the newest article (`lib/home.ts`, tested). How-to in `apps/cms/README.md` |
| ✅  | Scheduled publishing          | Done (2026-11-07) — "Schedule Publish" in the Publish menu of a saved article (`versions.drafts.schedulePublish`), run by Payload's jobs queue every minute inside the CMS (`jobs.autoRun`). Publishing also flips `status` draft → published so the site shows it. Migration `scheduled_publish`. How-to in `apps/cms/README.md` |
| ✅  | "Archived" status works      | Fixed 2026-11-07: `status` and Payload's `_status` shared one Postgres enum (draft/published), so saving Archived failed. `status` now has its own (`enumName`, migration `editorial_status_enum`) |
| ✅  | Pagination                    | Done (2026-11-07) — category, tag, author and game pages: 24 per page, `?page=N` with Newer/Older links, canonical per page, junk or out-of-range pages are 404s (`lib/pagination.ts`, tested) |
| ✅  | Slug redirects                | Done — `previousSlugs` on Articles, filled by a hook on rename; the article page 308-redirects old URLs. No separate redirects collection needed |
| ✅  | i18n fields                   | Done (2026-11-16) differently: a **Français** group on Articles (`fr`), `altFr` on Media, `nameFr` on Tags, `bioFr` on Authors, filled by the translation on publish (§6) |
| ✅  | Review score                  | Done (2026-11-12) — `score` on Articles (reviews only, out of 10, halves allowed, migration `review_score`): shown next to the category on the article and on cards, and sent as a schema.org `Review` with its `Rating` for search engines. The mobile app doesn't show it yet Since 2026-11-18 the score is a coloured pill everywhere (`ScoreBadge`, `lib/score.ts`, tested): metallic gold with a ring for 10, green from lime at 7 to very deep at 9, amber at 5 to yellow at 6, red below (dark maroon toward 0), each a small gradient with white text, colours far apart so 7, 8 and 9 read differently; on the review, the cards and the lead story |
| ✅  | Related games                 | Done (2026-11-12) — `relatedGames` on Articles ("Also covers", migration `related_games_gallery`): a recap lists on every game page it covers. Games also get `gallery` ("Other images") for the scout's cover rotation |

### Media & storage

| Pri | Item                          | Notes                                                                   |
| --- | ----------------------------- | ----------------------------------------------------------------------- |
| ✅  | Cloudflare R2 storage adapter | Done — `@payloadcms/storage-s3` wired to R2, live in prod |
| ✅  | Image sizes / focal point     | Done — `imageSizes` (thumbnail/card/hero/square) + focal point on the `media` collection; web requests the right variant |
| ✅  | Alt text required on media    | Already the case — `alt` is `required: true` in `Media.ts`              |
| ✅  | Photo credit                  | 2026-11-16, 🟠 migration `20261116_165443_media_credit` (additive): `credit` on Media ("BLAST / Luc Bouchon"), shown under the article's cover as "Photo: …" / "Photo : …". The scout's *Modifier* form takes it with the image URL; esport drafts say which photo to find (`photo_hint`: the player for a transfer, the team lifting the trophy for a win) |

### Operational

| Pri | Item                 | Notes                                                                                                          |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| ✅  | Email adapter        | Done — `@payloadcms/email-resend` sends password resets from `mail.akavish.gg`; falls back to console logging when `RESEND_API_KEY` is unset |
| ✅  | Versioned migrations | Done — `push: false`, migrations committed, applied locally and by Railway's pre-deploy step. See `DEPLOYMENT.md` §5 |
| ✅  | Seed script          | Done — `pnpm seed` (local DBs only), see the roadmap (#18) and the README                                     |
| ✅  | Backups              | Nightly `pg_dump` → private R2 bucket via GitHub Actions; restore runbook + drill in `DEPLOYMENT.md` §9 (rehearsed 2026-11-06) |

## 4. Search (Meilisearch)

Core search is done (see the [Done → Search](#search-meilisearch) section). Remaining:

| Pri | Item                        | Notes                                                           |
| --- | --------------------------- | --------------------------------------------------------------- |
| P3  | Hosted Meilisearch for prod | No longer urgent — `/api/search` falls back to the CMS (Postgres `ILIKE`), so search works in prod for free. Upgrade when article volume makes typo tolerance and ranking worth $20+/mo (Cloud has no free tier) or self-host on Railway |
| P3  | Search-only API key         | Generate a scoped key in prod instead of reusing the master key |

## 5. Auth & reader features

| Pri | Item                      | Notes                                                         |
| --- | ------------------------- | ------------------------------------------------------------- |
| P2  | Clerk on mobile           | Parked with the app: part of §7 "Catch up with the website" |

## 6. Internationalization (EN + FR)

Decided with Alex on 2026-11-16: the **whole site in French**, every new
article translated as it's published and every old one translated once; the
language follows the browser on the first visit, then the reader's choice; a
small menu next to the theme switch with 🇬🇧 EN, 🇺🇸 EN and 🇫🇷 FR. The two
English entries share the same text and only change how dates are written
(16 Nov 2026 / Nov 16, 2026): translating everything into British English too
would double the cost for a difference almost nobody sees.

Built on the `i18n` branch, merged into main the same day (Alex: no waiting
for after GTA VI week).

| Status | Step | Notes |
| --- | --- | --- |
| ✅ | 1. Interface | 2026-11-16. Pages under `app/[locale]`: English at the bare path (the proxy rewrites to `/en/…`), French under `/fr/…`, same slugs. `/en/…` 308s to the bare path. First visit: `Accept-Language` decides (a French browser opening `/news` lands on `/fr/news`, crawlers send none and stay English); once the reader picks in the menu, the `NEXT_LOCALE` cookie wins (a `/fr` link still opens in French). The English date style is the `akavish-region` cookie (`US` / `GB`, guessed from the same header), applied in the browser (`<DateText>`), so pages stay the same for everyone. Signed in, the choice is also saved in Clerk (`unsafeMetadata.locale` / `.region`) and a new device picks it up. Every interface string is in `lib/i18n/messages/{en,fr}.ts` (a test checks French has every key); links go through `components/LocaleLink.tsx`; dates through `lib/i18n/dates.ts`; `hreflang` + canonical through `lib/i18n/metadata.ts`; the sitemap lists both languages with their pair. Clerk's widgets in French (`@clerk/localizations`). Legal pages: the existing hand-written French versions moved to `/fr/privacy`, `/fr/terms`, `/fr/legal` (old URLs 308). Privacy EN/FR list the two new cookies. On phones the header lost "Log in" (the sign-up modal links to sign-in) to fit the menu, in French too, down to 320 px. Unit tests `lib/i18n/i18n.test.ts`, e2e `tests/e2e/i18n.e2e.spec.ts` |
| ✅ | 2. Content | 2026-11-16, 🟠 migration `20261116_130858_french_version` (additive). Not Payload's localization (it moves every localized column into `_locales` tables, a risky migration on live data): a **Français** group on Articles (`fr`: title, excerpt, content, SEO, status, `sourceHash`, `translatedAt`) plus `altFr` on Media, `nameFr` on Tags, `bioFr` on Authors. Publishing, or changing the English of a published article, queues `translateArticle` (queue `translate`, a minute later, one job per burst of edits); Claude Sonnet translates block by block in small markup so bold, italics and links survive (`apps/cms/src/lib/translate.ts`). Hand corrections in /admin stay until the English changes. Own budget (`TRANSLATE_MONTHLY_BUDGET_USD`, 30 $), usage purpose `translate`. Web: `localizeArticle` on /fr pages; untranslated → English with a notice, canonical to the English page, not in the sitemap as /fr; "Traduit de l'anglais avec l'aide de l'IA" under translated articles (terms EN/FR say so); tag names and bios in French; search covers both languages and answers in the page's (`lang=fr`; Meilisearch, English only, is skipped for French); share images in French |
| ✅ | 3. Backfill | 2026-11-16: `POST /api/translate/backfill` (DEPLOYMENT §12) ran on tags, bios, then every published article; all articles have their French version. New ones are translated on publish |
| ✅ | Live pages | 2026-11-16, from Alex: a live showcase page (scout live mode) changes every 5 minutes, so it stays **English while live**: no translation queued while its scout event is "live" / "ending" (`isLiveArticle`), one translation queued by `runLive` when it ends. The French page says "Live en cours, en anglais : la version française sera publiée à la fin du live" (`GET /api/live-articles`, public, ids only) |
| ✅ | French RSS | 2026-11-16: `/fr/feed.xml`, linked in the French footer |
| ⏳ | Later | French Meilisearch index if it's ever switched on. Newsletter in French: with the newsletter sending (🅿️ Parked) |

## 7. Mobile (`apps/mobile`)

| Pri | Item                              | Notes                                                                                                                                                                                                                                                                 |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | Upgrade Expo SDK 52 → 58          | Done (Nov 2026) — Expo 58.0 / React 19.3 / RN 0.88 / TypeScript 6, Node ≥ 22.13 for the mobile app. Splash moved from `app.json#splash` to the `expo-splash-screen` plugin; ESLint 9 flat config (`eslint.config.js`); expo-router's peers (`expo-linking`, `expo-constants`, `@expo/metro-runtime`) declared explicitly; unused `expo-notifications` and `@react-navigation/native` removed (push notifications come back with the item below). `types/expo.d.ts` keeps Expo's global types available in CI, where the generated `expo-env.d.ts` doesn't exist. Validated on an iPhone in Expo Go (needs an Expo account signed in on both the phone and `npx expo login`). Back in CI lint + type-check |
| ✅  | Fix api-client ↔ Payload shape    | Done — the Payload → `Article` mapper now lives in `@akavish/api-client/payload` and both web and mobile use it. `articlesApi.list` really returns `PaginatedResponse<Article>` (mobile's `res.data` was undefined), filters to published, populates relations; `get` no longer interpolates the slug raw into the URL |
| ✅  | Reading app (feature parity)      | Done (2026-11-09). Tabs: Home (latest, newest as a lead card), News, Leaks, Reviews, Sections (all six sections + About/Contact/Privacy/Terms on the site, app version). Article screen: cover, byline with reading time, native Lexical rendering (same node coverage as the web), share sheet, "Read on akavish.gg". Every list pages 12 at a time with infinite scroll, pull-to-refresh and reader-facing error/empty states. Deep links `akavish://article/<slug>` and `akavish://category/<slug>`. Categories and reading time now come from `@akavish/api-client` (shared with the web); lists load the 960px `card` cover (`coverImageCard`), not the 1920px hero. Unit tests on the pure helpers (`apps/mobile/src/lib`). Checked by bundling for iOS, rendering every screen on an iPhone viewport through Expo's web export, then on an iPhone in Expo Go (2026-11-09). Not in it: search, reader accounts, offline cache, universal links (`akavish.gg/...` opening the app needs an associated domain, with the store release) |
| ✅  | Drop the React `paths` workaround | Done (2026-11-06) — removed from the web and CMS tsconfigs; type-check passes with and without hoisting (see gotchas) |
| P1  | Check Babel 8 with Expo 58        | `@babel/core` went 7 → 8 on 2026-11-16 (Dependabot #6, merged on purpose) although Expo SDK 58 expects `^7.29.7` (`npx expo install --check`) and CI never bundles the app. Before working on the app again: bundle it (`npx expo export`, then Expo Go); if Metro breaks, go back to `^7.29.7` |
| P2  | Push notifications                | Expo notifications on new articles                                                                                                                                                                                                                                    |
| P3  | App store assets                  | Icons, splash, screenshots, listing copy                                                                                                                                                                                                                              |
| P3  | EAS build & submit                | iOS + Android pipelines                                                                                                                                                                                                                                               |

### Catch up with the website (parked, decided 2026-11-13)

The app stopped at the reading app of 2026-11-09; the website kept going.
**Decision (Alex): the app is parked, and when it's picked up again it first
catches up with everything below**, in one go, before anything new. Add to
this list every time the website gets a reader-facing feature.

| Website feature (since) | What the app needs |
| --- | --- |
| Reader accounts (11-10, Clerk) | Clerk Expo SDK: sign in / sign up with Google, Discord, Twitch (OAuth redirects, needs a dev build, not Expo Go) |
| Saved articles + `/account` (11-13) | Save button on the article screen, a "Saved" screen; a reader-authenticated API (today `/api/bookmarks` takes Clerk's web session: the app would send a Clerk session token) |
| Followed games (11-18) | Follow button on the game screen, a "My games" screen with their news (`/api/follows`, same reader-authenticated API question as Saved) |
| Reader badges (11-13) | `RoleBadge` next to the reader's name (account screen, comments) |
| Games page (11-16), games library (11-17) | A games screen (`fetchAllGames`: releases, companies) with the same filters as `/games` (console, year, month, studio / publisher, genre, out / upcoming; `lib/game-library.ts` is pure and can be shared), reachable from the tabs |
| Company pages (11-17) | A studio / publisher screen: its games, then the articles about them |
| Console pages (11-18) | A console screen: its release, games coming and latest releases, its articles; reached from the game screen's consoles, the games list's consoles row, the search (consoles and studios first) and article tags that stand for a console or a studio (`/api/platforms`, `fetchAllPlatforms` / `fetchTagPages` shapes) |
| Search with suggestions and filters (11-13, games first and initials since 11-16) | A search screen on `/api/search` (`games=1`, `facets=1`, `category`, `game`, highlighting from `lib/search-query.ts`) |
| Game pages, *Also covers* (11-12) | A game screen (cover, releases per console with their precision, developers / publishers linking their screen, its articles incl. `relatedGames`), linked from the article byline |
| Tag and author pages | Tag and author screens, from the article's #tags and byline |
| Review score /10 (11-12), coloured (11-18) | Score pill on the article screen and the cards, same colours as the site (`scoreColors` in `apps/web/src/lib/score.ts`: gold 10, green 7-9, yellow 5-6, red 0-4) |
| Lists grouped by day (11-12), latest first (11-17) | Section lists open on the 4 newest in one row, then the whole list with Today / Yesterday / date headers, month headers for a quiet section (`groupByDate`, `autoUnit`; esport always by day), conferences by year |
| Read next, previous / next (11-07) | Under the article |
| Newsletter sign-up (11-09) | A form (same CMS endpoint, consent box) |
| Light theme (11-07) | Follow the phone's light / dark setting |
| French version (11-16) | Language from the phone, a setting EN / FR; articles from `fr` (same `localizeArticle` logic), interface strings from `apps/web/src/lib/i18n/messages` |
| Photo credit (11-16) | "Photo: …" under the article's cover (`coverImageCredit`) |
| Comments (11-13) | Read, post, reply ("Replying to @name"), like / dislike, delete your own, report; moderators hide / restore / delete; same `/api/comments*` rules, with a Clerk session token |

## 8. Infrastructure, CI/CD & deployment

Monthly costs (paid, free with limits, coming): [`COSTS.md`](./COSTS.md). Neon moved to the Launch plan on 2026-11-19 after the Free plan's 5 GB transfer cap.

### Docker

| Pri | Item                         | Notes                                                                              |
| --- | ---------------------------- | ---------------------------------------------------------------------------------- |
| ✅  | Dockerfile for web           | Done (2026-11-06) — `apps/web/Dockerfile`: turbo prune → build with `NEXT_OUTPUT=standalone` → ~400 MB non-root image. Exit door only, production stays on Vercel. `DEPLOYMENT.md` §10 |
| ✅  | Dockerfile for CMS           | Done (2026-11-06) — Payload's starter replaced: same pattern, plus a `migrate` target for pre-deploy migrations. Tested with a real upload (sharp on Alpine). `DEPLOYMENT.md` §10 |
| ✅  | Extend root `docker-compose` | Postgres + Meilisearch for local dev. Web and CMS still run via `pnpm dev` (faster reloads than containers) |

### CI (GitHub Actions or similar)

Lint + type-check + build on PR are done (see [Done → CI/CD](#cicd)). Remaining:

| Pri | Item                     | Notes                                                                                            |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| ✅  | Lint + type-check mobile | Done with the Expo 58 upgrade (roadmap #12): ESLint 9 flat config, mobile back in CI lint + type-check |
| ✅  | CMS tests in CI          | Done (2026-11-06) — the Payload template's placeholder tests replaced: `test:int` covers slug generation + clash suffix, `publishedAt` stamping, `previousSlugs` on rename, public read access; `test:e2e` logs into the admin and opens the dashboard, users and articles. Both run in the CI build job after migrations + seed |
| ✅  | Preview deploys          | Already on (Vercel's default): every branch/PR gets a preview linked on the PR, reading the prod CMS. Confirmed 2026-11-06 — `DEPLOYMENT.md` §3 |
| ✅  | Dependabot               | Done (2026-11-06) — `.github/dependabot.yml`: weekly grouped npm PRs (minor/patch, Payload, Sentry; majors one by one), monthly Actions. React/RN/Expo ignored (move with Expo SDK upgrades). Browser-data packages (`caniuse-lite`, `baseline-browser-mapping`) exempt from its 3-day release-age window since 2026-11-09, they blocked a whole run. How to handle the PRs: README → Dependency updates |

### Deployment (production)

📄 Full runbook: **[`DEPLOYMENT.md`](./DEPLOYMENT.md)**. The steps below are the
checklist it walks through.

| Pri | Item                  | Notes                                                                                                                                              |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | Custom domains + DNS      | Done — `akavish.gg` (web) + `cms.akavish.gg` (CMS) on Cloudflare DNS, prod URLs wired, `www` 308s to the apex, Email Routing forwarding          |
| ✅  | CDN / caching             | Done (2026-11-07) — public API responses cached by Vercel's CDN (`s-maxage=60`, stale-while-revalidate). Media served from `media.akavish.gg`, cached by Cloudflare (2026-11-09, `DEPLOYMENT.md` §4e) |
| P2  | Mobile release            | Expo EAS build + store submission                                                                                                                  |
| P3  | Staging environment       | Mirror of prod for QA                                                                                                                              |

## 9. Observability, security & legal

| Pri | Item               | Notes                                                                  |
| --- | ------------------ | ---------------------------------------------------------------------- |
| ✅  | Error monitoring   | Sentry on web (client + server + edge, tunnelled through `/monitoring`) and CMS (server only). Errors + performance tracing, sampled to fit the free tier. Session Replay off on privacy grounds. Source maps upload confirmed 2026-11-06 (readable stack traces) |
| ✅  | Secrets management | Prod secrets live only in Railway / Vercel / GitHub secrets, never in committed files; rotation runbook in `DEPLOYMENT.md` §8 |
| ✅  | Rate limiting      | Done (2026-11-07) — per-IP limits on `/api/search` (30/min, 60 since 2026-11-13) and `/api/articles*` (120/min), 429 + Retry-After; in-memory, so approximate on Vercel; a Vercel Firewall rule (30/min on `/api/search`, 429) counts across instances since 2026-11-09 (`DEPLOYMENT.md` §4e) |
| ✅  | Uptime monitoring  | UptimeRobot probes on web + CMS/DB, email alerts (`DEPLOYMENT.md` §4d) |
| ✅  | Legal pages        | Done — `/privacy`, `/terms`, `/legal` in EN + FR (roadmap #8)          |
| ✅  | Cookie consent     | Not needed: cookieless analytics, only strictly necessary Clerk cookies — explained in `/privacy` |
| ✅  | Logging            | Done (2026-11-07) — JSON logs on web (`lib/log.ts`) and CMS (Payload logger in production), searchable in Vercel and Railway; no IPs or search terms (`DEPLOYMENT.md` §4e) |

## 10. Testing & docs

| Pri | Item                 | Notes                                                                  |
| --- | -------------------- | ---------------------------------------------------------------------- |
| ✅  | Unit tests           | vitest in `apps/web`, `apps/mobile`, `apps/cms` (`src/**/*.test.ts`) and `packages/api-client` (`pnpm test`), CMS integration (articles, newsletter, scout) + admin e2e tests, and Playwright on the public site (`apps/web/tests/e2e/`, desktop + mobile), all in CI |
| ✅  | API contract checks  | The shared mapper is unit-tested, and a test fails if the web and CMS category lists drift |
| ✅  | Contributor docs     | Done (2026-11-06) — `CONTRIBUTING.md`: the loop, adding a field/collection (migration steps), adding a page (data, SEO, a11y rules), where the tests live, commits |
| ✅  | Architecture diagram | Done (2026-11-06) — Mermaid diagram in the README ("How the pieces talk"): apps, hosts, every service, monitoring and backups |

---

## Known notes / gotchas

- Run the CMS and web as **two separate processes** (ports 3001 and 3000).
- **Games: one date per console, and the first one is computed.** Edit a
  game's dates in its *Releases* rows, never `releaseDate` (read-only, the
  hook recomputes it, with `platforms`). A date known only to the month,
  quarter or year is stored as its first day with the precision; the admin's
  date picker saves local midnight, the hook takes the nearest UTC day. Early
  access vs 1.0: the backfill used the full release (1.0) when announced.
  A cancelled game has no release row (it then shows in no period).
- **A deploy can stop the scout mid-run** (2026-11-18: nothing from 17:45
  to the evening, no 8 pm digest). Payload leaves the run "processing",
  schedules nothing while it exists and never retries it. Fixed: the
  schedule's `beforeSchedule` deletes a scout run older than 20 minutes
  (`releaseStaleScoutRuns`). If Discord goes quiet, check `scout-sources`
  *lastFetchedAt* in /admin: it moves every 5 minutes when the scout runs.
- **Consoles are documents, matched by name** (2026-11-18). A release links
  to *Platforms*; the scout matches a console on its slug, name or alias and
  creates the ones it doesn't find. A console it created under a different
  spelling (« PS6 » next to « PlayStation 6 »): add the spelling to the
  other's *aliases*, move its games, delete it. A brand tag isn't a console:
  the migration gave the « Xbox » tag to Xbox Series and kept « PlayStation »
  off the 1994 console.
- **Photos of people (esport) need the rights holder's OK.** Liquipedia's
  event photos are "copyrighted, used with permission": the organiser (BLAST,
  ESL, Riot…) allowed Liquipedia, not us, and BLAST's Flickr is "All rights
  reserved". So never take a photo from Liquipedia or an organiser's gallery
  without a written OK from the organiser; once given, fill the media's
  **Credit**. Permission requests went to BLAST, ESL and Riot on 2026-11-16;
  the four photos already used (articles 174, 178, 183, 184) stay until they
  answer and are taken down on request.
- **Keep the pages cacheable (ISR).** Until 2026-11-16 every page was
  rendered per request (`private, no-store`): Clerk's server `<SignedIn>` /
  `<SignedOut>` in the header read the session, and the list pages read
  `searchParams` for `?page=`. Now the header's auth is a client component
  (`components/HeaderAuth.tsx`), list pages read the page from the path (the
  proxy rewrites `?page=N` to `/page/N` internally: `[category]/page/[n]`,
  `tag|author|game/[slug]/page/[n]`, shared code in each `list.tsx`), and
  pages with a dynamic slug export `generateStaticParams() { return [] }`
  (rendered on first visit, then cached). In a page: no `cookies()`,
  `headers()`, `searchParams`, server Clerk helpers, or the page goes back to
  per-request (only `/account` and the newsletter pages are, on purpose).
  e2e checks the `Cache-Control` of a few pages.
- **Languages: never import `next/link` in the web.** Use
  `@/components/LocaleLink`, which keeps `/fr` on French pages; a plain
  `next/link` sends French readers to the English page. Server pages call
  `setRequestLocale((await params).locale)` first (and in `generateMetadata`),
  or `getMessages()` falls back to English.
- **No Vercel image optimization** (2026-11-18): its free plan counts every
  transformation (5,000 a month, 75 % used in the first week, past 100 % images
  break). `images.unoptimized: true`; every `<Image>` gets a size Payload
  already made, from `mediaUrl(…, 'card' | 'hero' | 'square')`: cards, search
  and saved articles use `coverImageCard`, the article top and the home lead
  `coverImage` (hero). A new `<Image>` must pick the smallest size that fits.
  Possible later: WebP for every size (`formatOptions` on the Media sizes; some
  PNG cards weigh 500 KB). `DEPLOYMENT.md` §4b.
- **List pagination uses plain `<a>` links, not `LocaleLink`** (fixed
  2026-11-18). List pages read their page from the path the proxy rewrites
  `?page=N` to (`/news/page/2`), so on French pages the client router took
  `/fr/news` and `/fr/news?page=2` for the same cached page: the address
  changed, the list didn't (English worked because its proxy rewrite told the
  router more). `components/Pagination.tsx` builds the href with `localHref`
  and does a full load. Same for any future link that only changes `?page=`.
- **A reader's `emailVerified` in the CMS can be stale.** It's refreshed from
  Clerk on each write (and on `/account`), not when the reader verifies. So the
  comments form trusts Clerk's own client-side status, never the CMS copy
  (2026-11-13: accounts synced before comments existed saw "Verify your email"
  while verified). The server checks Clerk again on every write.
- **ISR serves stale once.** With `revalidate = 30`, the first visit after 30 s
  gets the old page while Next rebuilds it in the background, and the CMS
  fetch cache has its own 30 s on top: that's why a category page needed 2-3
  reloads to show a new article (Nov 2026). Fixed with on-demand revalidation
  (`/api/revalidate`, `cms` cache tag); every web read of the CMS must go
  through `cmsFetch` to get the tag.
- **Flushing the whole cache on every save is expensive.** Until 2026-11-19
  each CMS save (the scout saves games, tags, translations…) dropped every
  cached page: ~15K Vercel ISR writes a day (137K of the 200K free a month)
  and most of the CPU. Now the ping names cache tags (`TAGS` in
  `apps/web/src/lib/revalidate.ts`, built the same way in
  `apps/cms/src/lib/revalidate-web.ts`). A new CMS read picks its tag: a list
  of articles → `TAGS.articles` (5 min), one document → its own tag (1 h), an
  entity page's articles → the entity's tag (`fetchArticles({ cacheTags })`).
  Untagged reads only follow their timer. CI sets `REVALIDATE_SECRET` so the
  e2e tests that edit content (French version, cover credit) use the ping. Renames shown on other pages
  (a studio's name on a game page) catch up within the hour.
- **Editors don't see the readers.** Readers, Subscribers, saved articles and
  followed games are admins-only (personal data), so Payload hides the whole
  Readers group from an editor account, such as the scout's
  (`scout@akavish.gg`). Logged in with it by mistake (2026-11-23), the admin
  looked like it had lost them. The header now shows the logged-in email and
  role, with a visible Log out (`src/components/admin/AccountBar.tsx`).
- **Tailwind 4** (2026-11-23, Dependabot #11 couldn't pass alone): migrated
  with `@tailwindcss/upgrade`, the theme moved to `@theme inline` in
  `globals.css`, `@tailwindcss/postcss` replaces `autoprefixer`. Kept v3's
  look on purpose: pointer cursor on buttons, grey placeholders, gray-200
  default border (compat block in `globals.css`), and `ContentPage` headings
  lost their `mt-8 mb-2` (v3's `space-y-4` overrode them; v4 wouldn't).
  Checked: 52 screenshots (13 pages × dark/light × desktop/phone) identical
  to v3. Needs Safari 16.4+, Chrome 111+, Firefox 128+.
- Articles must be **Published** to appear publicly; drafts are editor-only.
- **CI and Ubuntu's apt mirrors.** GitHub runners sometimes can't resolve the
  Ubuntu mirrors; `playwright install --with-deps` then hung 25 min and failed
  (2026-11-11). CI now installs Chromium from Playwright's CDN and the system
  libraries best-effort, capped at 4 min (`ci.yml`). If e2e then fails on a
  missing library, just re-run the job later.
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
- **A plugin's schema must not depend on an env var.** The R2 storage plugin
  only added `prefix` / `_objectKey` to `media` when `R2_BUCKET` was set, so the
  Payload 3.93 migration, generated locally without R2, missed them and prod's
  `/api/media` answered 500 until 2026-11-09 (fix: `alwaysInsertFields: true` +
  migration `storage_object_key`). Check any new plugin for the same trap.
- **Categories have one source: `packages/api-client/src/categories.ts`**
  (web and mobile; the web's `lib/categories.ts` just re-exports it). Slug
  (`leaks`), CMS value (`leak`) and labels live there; it must match the
  `category` select options in `apps/cms/src/collections/Articles.ts` (a test
  checks). A few components still keep
  their own singular-label map (`ArticleCard`, the article page, `SearchResults`,
  the OG image) — migrate them when next touched.
- **The scout fetches as an identified bot, and takes no for an answer.** Its
  User-Agent is `AkavishScout/1.0 (+https://akavish.gg)`. A site that answers
  403 to it doesn't want automated readers: drop the feed, never switch to a
  browser User-Agent to get through. Same spirit as Reddit (left out because
  commercial use needs their agreement) and X (official API only).
- **`pnpm test` in `apps/cms` is the unit tests now** (`src/**/*.test.ts`, no
  database); the integration and admin tests stay `test:int` and `test:e2e`.
- **Hydration can fail, rarely, for reasons outside our code.** Removing a
  `<script>` from `<head>` while React is still hydrating makes it throw the
  server HTML away (React #418) and re-render the whole document, which also
  resets `<html>`'s attributes. Three sources were found (Nov 2026, through the
  then-flaky theme e2e test): Next's chunk loader (~1 load in 30 locally, can't
  be fixed on our side), Vercel Analytics' script failing to load (an ad
  blocker does that: now mounted after `load`, `components/DeferredAnalytics.tsx`)
  and Clerk's script failing to load (the e2e fixture now serves it empty
  instead of aborting it). The page still works; what got lost was the reader's
  light theme, and `ThemeToggle` now restores it after such a re-render. Rule:
  anything set on `<html>` or `<body>` outside React must be re-applied on
  mount, never set once by a script only.
- **Contrast on the dark theme:** small text on `zinc-950`/`zinc-900` must be
  `text-zinc-400` or lighter. `zinc-500` (4.1:1) only passes for large bold text
  (the Wordmark's "ish"); `zinc-600` (2.6:1) never does. White text on green
  buttons needs `bg-emerald-700` (`600` is 3.8:1). Found by the #20 audit.
- **Light/dark theme: write the dark classes, never raw hex.** `bg-zinc-950`,
  `text-white`, `text-zinc-400`, `text-emerald-400`… are CSS variables that
  flip for the light theme (`globals.css`). A hard-coded colour (`#09090b`,
  `style={{ color }}`) stays dark in light mode. Text on the green buttons is
  `text-on-accent` (always white), not `text-white` (which turns black).
  Exceptions on purpose: `global-error.tsx` (renders outside the layout, dark
  only) and the OG images (`lib/og.tsx`).
- **Card images take `alt=""`** — the title is right next to them in the same
  link. The article hero uses the editor's alt (`article.coverImageAlt`).
- **No `loading.tsx` on routes that can 404 or redirect.** A `loading.tsx`
  makes Next stream the page, and once streaming has started `notFound()` and
  `permanentRedirect()` can't change the status: a missing article answered
  **200** and a renamed one did a client-side hop instead of a **308**. Only the
  home page keeps one, inside the `(home)` route group so it covers nothing
  else. The public e2e tests check the real 404 and 308.
- **Never show operational details to readers.** Fallbacks go through
  `components/StatusMessage.tsx`; diagnostics belong in Sentry and the logs.
- **`app/(home)/loading.tsx` mirrors the home layout** — change one, change the other,
  or the page jumps when content arrives.
- **`overrides` in `pnpm-workspace.yaml` are security pins only** (transitive
  packages with a known vulnerability, each kept to its parent's major — see
  README → Dependency updates). Don't add React there, as below.
- **Don't re-add React `overrides` to `pnpm-workspace.yaml`.** They were there
  for months but never applied (pnpm only reads them from that file since 10.5,
  and `packageManager` was pinned to pnpm 9 — the lockfile had no `overrides:`
  block, which proved it). Each app resolves its own React types from its own
  `node_modules` (pnpm's default isolated layout). A repo-wide `react`
  override would force one exact React version on every app, but each app pins
  its own: Expo pins React to the SDK (19.3.0 on SDK 58, must match React
  Native exactly), Next and Payload pin theirs (19.2.x).
- **`.npmrc` is local-only.** It's gitignored, so CI, Vercel and Railway have
  always installed **without** it (pnpm's default isolated layout) — and build,
  run and pass the CMS tests that way. A local `.npmrc` with
  `shamefully-hoist=true` / `public-hoist-pattern[]` only makes your machine
  differ from production; it isn't needed. From pnpm 11, `.npmrc` may only hold
  auth/registry settings, which is one more reason not to rely on it.
- **Clerk proxy matcher (`apps/web/src/proxy.ts`, `middleware.ts` before Next 16) — don't re-add the file-extension exclusion.**
  Clerk's boilerplate matcher skips paths ending in `.ico`, `.png`, `.css`… on
  the assumption they're static files. This app has **no `public/` directory**,
  so such a path is never a real file: it falls through to the top-level
  `[category]` route, whose layout calls `auth()`, which throws when the
  proxy didn't run. That produced a **500 on every browser's automatic
  `/favicon.ico` request** — one Sentry event per visitor, and the free tier is
  5 000/month. Found by Sentry within hours of switching it on. The matcher now
  excludes only `_next`, `_vercel` and `monitoring`.
- **App icons live in `apps/web/src/app/`** (`favicon.ico`, `icon.png`,
  `apple-icon.png`), generated by `apps/web/scripts/generate-icons.py`
  (`python3 apps/web/scripts/generate-icons.py`, needs Pillow). Regenerate rather
  than hand-editing, so every size stays consistent.
- **React types `paths` workaround — removed (2026-11-06).** The web and CMS
  tsconfigs used to pin `react` / `react-dom` types to each app's own copy,
  because a hoisted `@types/react@18` from the old Expo app broke their
  type-check. Every app is on React 19 now: `pnpm type-check` passes without
  those entries, both with pnpm's default layout (CI) and with a hoisting
  `.npmrc`. If bogus "cannot be used as a JSX component" errors ever come back,
  look for two React majors in the tree first.
