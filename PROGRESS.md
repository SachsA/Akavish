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
| ✅     | Reading app                 | 2026-11-09: tabs Home / News / Leaks / Reviews / Sections, article screen, every section, pull-to-refresh, infinite scroll, share. Validated on an iPhone in Expo Go. Details in §7 |
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

**In progress: the AI news scout** (section below). Steps 1 (observation) and
2 (drafts + Discord buttons) are live in production since 2026-11-10, bot set
up. Automatic drafts stay **off** until the weekend review of the digests
(Nov 14-15), so they're ready for GTA VI on Thursday Nov 19.

Everything else waits on something:

| Waits on | Items (in the backlog below) |
| --- | --- |
| **More than one writer** | Editorial roles & review flow · author ↔ CMS user link |
| **The app being shipped** | Push notifications · store release (EAS) · app store assets · universal links |
| **Traffic** | Reader accounts (`/account`, Clerk → DB sync) · hosted Meilisearch |
| **Content and readers** | Everything in **🅿️ Parked**: sending the newsletter, analytics review, comments, Clerk production |
| **Money / launch** | Legal review by a professional (before monetising) |

i18n (EN + FR) is its own project — §6.

> **The real bottleneck is content, not code.** The production CMS has had zero
> articles since October 2026. Pagination, analytics and search polish only mean
> something once there's a steady publishing rhythm.

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
| 1. Observation | ✅ live 2026-11-10 | 38 RSS feeds (all `ok` / `not modified` in production on day 1, none refused), grouping + score (Haiku), digests at 8 am / 8 pm, budget caps |
| 2. Drafts + validation | ✅ live 2026-11-10, automatic drafts **off** until the review | Sonnet drafts in the CMS (draft, `aiAssisted`), Discord bot with Publish / Edit (→ V2 as a reply) / Reject, "Rédiger…" menu under each digest. Switch: `draftsEnabled` in Scout settings |
| 3. Leakers + style | Later | X accounts (pay-per-use API), learning from published / rejected drafts |
| 4. Esport | Later | Daily recaps and big tournaments, once the results source is chosen (Liquipedia or PandaScore) |
| 5. Event mode | Later | `/scout live <name>`: one recap updated every 30 min during showcases |

**Timeline to GTA VI (Thu Nov 19):**

- ✅ Nov 10: step 1 and step 2 live, bot set up, default author *Akavish*,
  feed statuses checked (all fine).
- Nov 10, 8 pm: first digest sent by the bot. Test the whole chain by hand
  with its "Rédiger…" menu: one draft, one *Modifier* (V2 as a reply), then
  *Rejeter*. Nothing is published.
- Nov 11-14: digests only (observation cut to 4-5 days). Note the stories that
  should have scored higher or lower. Before the review, test *Publier* once
  on a real story and check the article and its AI note on akavish.gg.
- Nov 14-15: review. Tune the threshold, then tick `draftsEnabled`.
- Nov 16-18: running-in with automatic drafts.
- Nov 19: ready.

**AI transparency:** articles drafted by the scout carry `aiAssisted`, which
shows a one-line note under the article (web and app); `/terms` and
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
| Comments | Needs traffic, paid Clerk production keys, moderation and anti-spam (§5) |
| Clerk production instance | Paid; only needed once reader accounts do something (§8) |

---

# Backlog — everything left to do

Grouped by area. Rough priority: **P1** = needed before a public launch ·
**P2** = strongly wanted soon after · **P3** = nice-to-have / later.

## 1. Website (public frontend — `apps/web`)

### Pages & navigation

| Pri | Item                         | Notes                                                                                       |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| ✅  | Newsletter sign-up           | Done (2026-11-09). Form in the footer of every page and at the end of articles: email + unticked consent box + honeypot, `/api/newsletter` (5/min per IP) → CMS `/api/newsletter/subscribe`. **Double opt-in**: a confirmation email (`lib/emails/newsletter-confirm.ts`), nobody is subscribed until they click it (`/newsletter/confirm`). Same answer whether the address is new, pending or already in, so the form can't reveal who's subscribed; one confirmation email per address per 10 min. Unsubscribe (`/newsletter/unsubscribe`, asks for a click) **deletes** the row; unconfirmed sign-ups are deleted after 30 days. Confirm token stored hashed; unsubscribe links are HMAC-signed with `PAYLOAD_SECRET`. `subscribers` collection, editors can read, nobody can add. `/privacy` (EN + FR) and the processor list updated. Tested end to end in production on 2026-11-09 (real sign-up, confirmation email via Resend, confirmed in `/admin`). Sending issues: 🅿️ Parked |
| ✅  | Single article polish        | Done — reading time in the byline, share row (X/Reddit/Bluesky/WhatsApp + native share sheet + copy link), "Read next" suggestions and prev/next navigation |
| P2  | Legal review by a professional | The pages are written and factually accurate, but **not reviewed by a lawyer**. Worth doing before monetising (affiliate/sponsored disclosures) or if traffic grows |
| ✅  | Homepage layout pass         | Done — lead story, top stories, per-category sections (see roadmap #9). "Trending" would need view counts, not available yet |
| P3  | Search polish                | Highlighting, filters by category, instant/typeahead results                                |
| ✅  | Dark/light toggle            | Done (2026-11-07) — follows the OS, sun/moon switch in the header remembers the choice (no flash on reload). Components keep the dark classes; `tailwind.config.ts` maps zinc/white/emerald text to CSS variables that flip in `globals.css`. axe-clean in both themes, header fits from 320 px |
| P3  | Comments                     | Reader comments (needs reader auth + a comments store/service)                              |

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
| P3  | Author ↔ user link            | Connect a CMS `user` (editor) to an `author` profile. Only matters once there's more than one writer |
| P2  | Editorial workflow            | Roles (admin / editor / writer) + access control per role; review/publish flow |
| ✅  | Homepage curation             | Done (2026-11-06) — `featured` checkbox on articles (migration `article_featured`): the newest featured article is the homepage lead, else the newest article (`lib/home.ts`, tested). How-to in `apps/cms/README.md` |
| ✅  | Scheduled publishing          | Done (2026-11-07) — "Schedule Publish" in the Publish menu of a saved article (`versions.drafts.schedulePublish`), run by Payload's jobs queue every minute inside the CMS (`jobs.autoRun`). Publishing also flips `status` draft → published so the site shows it. Migration `scheduled_publish`. How-to in `apps/cms/README.md` |
| ✅  | "Archived" status works      | Fixed 2026-11-07: `status` and Payload's `_status` shared one Postgres enum (draft/published), so saving Archived failed. `status` now has its own (`enumName`, migration `editorial_status_enum`) |
| ✅  | Pagination                    | Done (2026-11-07) — category, tag, author and game pages: 24 per page, `?page=N` with Newer/Older links, canonical per page, junk or out-of-range pages are 404s (`lib/pagination.ts`, tested) |
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
| ✅  | Backups              | Nightly `pg_dump` → private R2 bucket via GitHub Actions; restore runbook + drill in `DEPLOYMENT.md` §9 (rehearsed 2026-11-06) |

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
| ✅  | Reading app (feature parity)      | Done (2026-11-09). Tabs: Home (latest, newest as a lead card), News, Leaks, Reviews, Sections (all six sections + About/Contact/Privacy/Terms on the site, app version). Article screen: cover, byline with reading time, native Lexical rendering (same node coverage as the web), share sheet, "Read on akavish.gg". Every list pages 12 at a time with infinite scroll, pull-to-refresh and reader-facing error/empty states. Deep links `akavish://article/<slug>` and `akavish://category/<slug>`. Categories and reading time now come from `@akavish/api-client` (shared with the web); lists load the 960px `card` cover (`coverImageCard`), not the 1920px hero. Unit tests on the pure helpers (`apps/mobile/src/lib`). Checked by bundling for iOS, rendering every screen on an iPhone viewport through Expo's web export, then on an iPhone in Expo Go (2026-11-09). Not in it: search, reader accounts, offline cache, universal links (`akavish.gg/...` opening the app needs an associated domain, with the store release) |
| ✅  | Drop the React `paths` workaround | Done (2026-11-06) — removed from the web and CMS tsconfigs; type-check passes with and without hoisting (see gotchas) |
| P2  | Push notifications                | Expo notifications on new articles                                                                                                                                                                                                                                    |
| P3  | App store assets                  | Icons, splash, screenshots, listing copy                                                                                                                                                                                                                              |
| P3  | EAS build & submit                | iOS + Android pipelines                                                                                                                                                                                                                                               |

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
| ✅  | Rate limiting      | Done (2026-11-07) — per-IP limits on `/api/search` (30/min) and `/api/articles*` (120/min), 429 + Retry-After; in-memory, so approximate on Vercel; a Vercel Firewall rule (30/min on `/api/search`, 429) counts across instances since 2026-11-09 (`DEPLOYMENT.md` §4e) |
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
