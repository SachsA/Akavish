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
| ✅     | Category pages `/[category]`          | news, leaks, reviews, esport, previews, conferences. Grouped under a heading per day (Today, Yesterday, then the date; per year for conferences), `lib/date-groups.ts`, tested |
| ✅     | Author pages `/author/[slug]`         | Profile (avatar, bio, twitter) + their published articles                           |
| ✅     | Game pages `/game/[slug]`             | Game metadata (landscape cover, platform, genre, dev/publisher, "Out" for a date to come) + coverage: articles whose `game` is it **or** that also cover it (`relatedGames`, e.g. conference recaps) |
| ✅     | Tag pages `/tag/[slug]`               | Articles filtered by tag                                                            |
| ✅     | Cross-links                           | Article byline → author/game; tag chips → tag pages                                 |
| ✅     | Custom 404 / error pages              | `not-found.tsx`, `error.tsx`, `global-error.tsx`                                    |
| ✅     | Functional footer                     | Sections, About/Contact/Legal, RSS, socials — all targets now exist                 |
| ✅     | Footer pages                          | `/about`, `/contact`, plus the legal set below                                       |
| ✅     | Legal pages (EN + FR)                 | `/privacy`, `/terms`, `/legal` and `/fr/confidentialite`, `/fr/conditions`, `/fr/mentions-legales`. Facts (processors, publisher, date) live once in `lib/legal.ts`; hreflang pairs + language toggle via `LegalLanguageSwitch` |
| ✅     | RSS feed `/feed.xml`                  | Route handler, latest 50 published articles                                         |
| ✅     | Loading states                        | Home only (`app/(home)/loading.tsx`). The other routes dropped theirs on 2026-11-07 so `notFound()` and slug redirects answer real 404/308 statuses (see gotchas) |
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
| ✅     | Sync Clerk users → CMS           | 2026-11-13 — `readers` collection, one row per Clerk account, created on the first visit to `/account` or first Save (`READER_API_SECRET`, server to server) and kept in sync by Clerk's webhook (`/api/clerk/webhook`, Svix signature): deleting the account deletes the reader and their saved articles. `DEPLOYMENT.md` §6.5b |
| ✅     | Reader roles and badges          | 2026-11-13 — Owner (one account only), Admin, Mod, Author, Reader, set by an admin in `/admin` → Readers. A reader whose verified email is a CMS user's is linked to it and its author profile and shown as Author. Badge on `/account` and next to the name on comments |
| ✅     | Comments                         | 2026-11-13 — under every article (`components/Comments.tsx`, CMS `src/lib/comments.ts`). Verified, unbanned readers only; plain text, 2,000 characters, no images, links stay text; threads one level deep with "Replying to @name"; like / dislike (not your own), top comments by likes then oldest, replies oldest first; no editing, delete your own (a comment with replies stays as "Comment deleted"); Owner / Admin / Mod readers hide, restore and delete anyone's. Anti-spam: one every 30 s, 30 a day, no duplicates, accounts under 10 minutes old wait. **Report** (spam, harassment, illegal, other + note): once per reader, goes to `/admin` → Community → Reports and to a private Discord moderation channel (`MODERATION_DISCORD_WEBHOOK_URL`); 3 reports from different readers hide the comment until a moderator restores it. Switches: `/admin` → Community settings → *Comments on* (everything, at once) and *Comments closed* per article. Public name = Clerk username (required at sign-up since 2026-11-13). Terms (community rules, reporting) and privacy, EN + FR, and Discord added to the processors. `DEPLOYMENT.md` §6.5c |
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
| 9   | ✅ **Homepage layout**              | Done — masthead with real section links, lead story + "Top stories" column, one section per category. Since 2026-11-11 the sections include the lead and top stories too (a big story still shows in its own category; `sectionArticles` in `lib/home.ts`). Degrades cleanly down to one article or an empty state. Skeleton in `loading.tsx` mirrors it | —      |
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
(same value) on Railway and Vercel — `DEPLOYMENT.md` §4e. **Automatic drafts are on since 2026-11-11** (threshold 60, at most 20 a
day), a few days ahead of the plan; the weekend review (Nov 14-15) tunes
them, so they're ready for GTA VI on Thursday Nov 19.

Everything else waits on something:

| Waits on | Items (in the backlog below) |
| --- | --- |
| **The app being shipped** | Push notifications · store release (EAS) · app store assets · universal links |
| **Traffic** | Hosted Meilisearch |
| **Content and readers** | Everything in **🅿️ Parked**: sending the newsletter, analytics review |
| **Money / launch** | Legal review by a professional (before monetising) |

i18n (EN + FR) is its own project — §6.

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
| 2. Drafts + validation | ✅ live 2026-11-10, automatic drafts **on** since 2026-11-11 (threshold 60, 20/day) | Sonnet drafts in the CMS (draft, `aiAssisted`), Discord bot with Publish / Edit (→ V2 as a reply) / Reject, "Rédiger…" menu under each digest. Switch: `draftsEnabled` in Scout settings. **Media** (2026-11-11): a cover on every draft (official source's `og:image`, else the game's cover, never a press outlet's image), official YouTube videos in a *Watch* section, an image URL field in *Modifier*, Publish refused without a cover. **Tags and game** (2026-11-11, reworked the same evening after wrong picks): 2 to 5 tags in a set order (company, platforms, theme), existing ones plus at most 2 created; the game only when the story is about it, created when missing; both cleaned up on a rejection; cover alt text from the publisher's `og:image:alt`. **Duplicates** (2026-11-11): a Haiku check skips automatic drafts of news already covered or recently rejected. **Scores and grouping** (2026-11-12, from the editor's review of a digest): new weights (significance ×0.6, +5 per outlet, official 25 / outlet 15), a richer significance guide, the triage sees 3 days of stories that matter instead of the last few hours, and items repeating an Akavish article are set aside before they become stories. Field by field: `DEPLOYMENT.md` §11 |
| 3. Leakers + style | Later | X accounts (pay-per-use API; when it's paid, also switch X sign-in back on in Clerk, `DEPLOYMENT.md` §6.5), learning from published / rejected drafts |
| 4. Esport | Later | Daily recaps and big tournaments, once the results source is chosen (Liquipedia or PandaScore) |
| 5. Event mode | ✅ built 2026-11-12 (migration `scout_events`), first real use at the next showcase | `/live start <name> [image]`, `/live add <text + links>` (or `#3 …` to correct or complete entry 3), `/live image`, `/live stop`, `/live status` on Discord. One live article, short entries newest first (headline, one or two sentences, trailer and official links, link to the game's page), updated every 5 min from the editor's notes and the feeds, repeats merged, entries completed as new facts come in, new games get their page. First version validated by "Publier le live", then updates go live by themselves with "Annuler cette MAJ". On stop: "the show is over" and a recap article drafted for validation. `DEPLOYMENT.md` §11 |

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
- ✅ Nov 11: `draftsEnabled` ticked (threshold 60, `maxDraftsPerDay` 20).
- Nov 11-18: running-in with automatic drafts.
- ✅ Launch article ready (Nov 11): "GTA VI is out" (id 20), scheduled for
  Nov 18, 11:00 UTC (midnight in New Zealand, the first unlock; Rockstar:
  "midnight local time … in all regions"), `featured` already ticked so it
  becomes the lead by itself.
- Nov 18-19: `maxDraftsPerDay` to 40 for launch day (then 20 or 30 from the
  review). Untick `featured` on "GTA VI: everything we know" (id 5) whenever
  convenient: the newest featured article already wins.

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
| Newsletter: the digest | Sign-ups are live since 2026-11-09 (see §1); what waits is **sending** issues: a digest template with the per-subscriber unsubscribe link (`unsubscribeUrl(id)` in `apps/cms/src/lib/newsletter.ts`) and a `List-Unsubscribe` header, sent to `status: confirmed` only. Resend's free tier is 100 emails/day, so a list past ~100 needs its paid plan or batched sends. The AI scout can feed it |
| Analytics review | Vercel Analytics is collecting; reading it means something once there's traffic |

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
| P2  | Legal review by a professional | The pages are written and factually accurate, but **not reviewed by a lawyer**. Worth doing before monetising (affiliate/sponsored disclosures) or if traffic grows |
| ✅  | Homepage layout pass         | Done — lead story, top stories, per-category sections (see roadmap #9). "Trending" would need view counts, not available yet |
| ✅  | Dark/light toggle            | Done (2026-11-07) — follows the OS, sun/moon switch in the header remembers the choice (no flash on reload). Components keep the dark classes; `tailwind.config.ts` maps zinc/white/emerald text to CSS variables that flip in `globals.css`. axe-clean in both themes, header fits from 320 px |
| ✅  | Conferences in the header     | Done (2026-11-12) — the section links (News, Leaks, Reviews, Esport, Conferences) show from 1024 px; below that the swipeable strip of every section (was phones only, the header overflowed between 640 and 1024 px) |

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
| P3  | Per-locale hreflang             | Only once i18n lands (area 6)                             |

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
| P3  | i18n fields                   | Localized title/content if going bilingual (area 6)                            |
| ✅  | Review score                  | Done (2026-11-12) — `score` on Articles (reviews only, out of 10, halves allowed, migration `review_score`): shown next to the category on the article and on cards, and sent as a schema.org `Review` with its `Rating` for search engines. The mobile app doesn't show it yet |
| ✅  | Related games                 | Done (2026-11-12) — `relatedGames` on Articles ("Also covers", migration `related_games_gallery`): a recap lists on every game page it covers. Games also get `gallery` ("Other images") for the scout's cover rotation |

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
| ✅  | Reading app (feature parity)      | Done (2026-11-09). Tabs: Home (latest, newest as a lead card), News, Leaks, Reviews, Sections (all six sections + About/Contact/Privacy/Terms on the site, app version). Article screen: cover, byline with reading time, native Lexical rendering (same node coverage as the web), share sheet, "Read on akavish.gg". Every list pages 12 at a time with infinite scroll, pull-to-refresh and reader-facing error/empty states. Deep links `akavish://article/<slug>` and `akavish://category/<slug>`. Categories and reading time now come from `@akavish/api-client` (shared with the web); lists load the 960px `card` cover (`coverImageCard`), not the 1920px hero. Unit tests on the pure helpers (`apps/mobile/src/lib`). Checked by bundling for iOS, rendering every screen on an iPhone viewport through Expo's web export, then on an iPhone in Expo Go (2026-11-09). Not in it: search, reader accounts, offline cache, universal links (`akavish.gg/...` opening the app needs an associated domain, with the store release) |
| ✅  | Drop the React `paths` workaround | Done (2026-11-06) — removed from the web and CMS tsconfigs; type-check passes with and without hoisting (see gotchas) |
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
| Reader badges (11-13) | `RoleBadge` next to the reader's name (account screen, comments) |
| Search with suggestions and filters (11-13) | A search screen on `/api/search` (`games=1`, `facets=1`, `category`, `game`, highlighting from `lib/search-query.ts`) |
| Game pages, *Also covers* (11-12) | A game screen (cover, studio, platforms, its articles incl. `relatedGames`), linked from the article byline |
| Tag and author pages | Tag and author screens, from the article's #tags and byline |
| Review score /10 (11-12) | Score badge on the article screen and the cards |
| Lists grouped by day (11-12) | Today / Yesterday / date headers in the section lists (`groupByDate`, conferences by year) |
| Read next, previous / next (11-07) | Under the article |
| Newsletter sign-up (11-09) | A form (same CMS endpoint, consent box) |
| Light theme (11-07) | Follow the phone's light / dark setting |
| Comments (11-13) | Read, post, reply ("Replying to @name"), like / dislike, delete your own, report; moderators hide / restore / delete; same `/api/comments*` rules, with a Clerk session token |

## 8. Infrastructure, CI/CD & deployment

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
- **React types `paths` workaround — removed (2026-11-06).** The web and CMS
  tsconfigs used to pin `react` / `react-dom` types to each app's own copy,
  because a hoisted `@types/react@18` from the old Expo app broke their
  type-check. Every app is on React 19 now: `pnpm type-check` passes without
  those entries, both with pnpm's default layout (CI) and with a hoisting
  `.npmrc`. If bogus "cannot be used as a JSX component" errors ever come back,
  look for two React majors in the tree first.
