# Working agreement for Claude on Akavish

Read this first. These are standing instructions for **every** change made to this
repo — follow them without being asked.

> **Mirrored file:** [`AGENTS.md`](./AGENTS.md) holds the same agreement for Codex.
> If you change one, change the other — they must not drift.

## 1. After ANY change, update & verify ALL docs/config (not just `.md`)

Sweep this whole set every time and fix anything stale — commands, paths, ports,
URLs, script names, env vars, versions:

- **Markdown:** `README.md` (root, incl. its architecture diagram),
  `CONTRIBUTING.md`, `apps/cms/README.md`, `PROGRESS.md`, `DEPLOYMENT.md`,
  `apps/cms/CLAUDE.md`, and any other `.md`.
- **Env templates:** `apps/web/.env.example`, `apps/cms/.env.example`,
  `apps/mobile/.env.example` — must list every `process.env.*` / `EXPO_PUBLIC_*`
  the code actually reads, and match the DEPLOYMENT env reference tables.
- **`.gitignore`** (root + each app) — secrets ignored; `.env.example`, migrations,
  and the root `pnpm-lock.yaml` tracked.
- **`package.json` scripts** (root + apps) — if a script is added/renamed/removed,
  update every doc that references it, and vice-versa.
- **CI / infra:** `.github/workflows/ci.yml`, `docker-compose.yml`, `turbo.json`,
  `pnpm-workspace.yaml`, `next.config.ts`, `tsconfig*` — keep commands/settings/comments accurate.
- **Scripts:** `scripts/*.sh`, `apps/cms/scripts/*.mjs` — headers + usage strings.
- **Code comments** describing behaviour (e.g. `payload.config.ts` push note,
  the `vitest.setup.ts` localhost guard) — keep them true.
- **Legal pages:** adding any third-party service that can see visitor data means
  adding it to `apps/web/src/lib/legal.ts` (`PROCESSORS`) **in the same commit** —
  both the EN and FR privacy pages render that list, so they stay in sync
  automatically. Bump `LEGAL_LAST_UPDATED` when the substance changes. Changing
  Sentry's `dataCollection`, enabling Session Replay, or adding cookies that
  aren't strictly necessary all invalidate what `/privacy` currently promises.

- **Mobile catch-up list:** the app is parked. Every reader-facing feature
  added to the website gets a row in `PROGRESS.md` §7 "Catch up with the
  website", so the app can catch up in one go when it's picked up again.

Cross-check that any command/port/URL/script/version stated in one place matches
reality everywhere (a grep sweep beats eyeballing). Keep `PROGRESS.md` (done +
backlog) and the READMEs in sync with the real code state. **Doc upkeep is part of
"done."**

## 2. Tell the user which kind of push it is

- **🟠 Migration push** — only when a **DB-shape change** is made, i.e. editing a
  collection in `apps/cms/src/collections/` (add/remove field, change type, add a
  collection/relationship/index). On an auth collection, `verify`,
  `loginWithUsername`, `useAPIKey` and `useSessions` also change the shape.
  Touching a collection file is **not** by itself a migration: runtime-only
  config (access control, hooks, admin options, `auth.forgotPassword` email
  templates) adds no columns. When unsure, run `pnpm migrate:create check` — an
  empty up/down proves there's nothing to migrate; delete it and push 🟢.
  Then, before committing:
  ```bash
  cd apps/cms && pnpm migrate:create <name> && pnpm migrate
  ```
  Railway's pre-deploy runs `pnpm migrate` on prod. `pnpm migrate` is
  non-destructive (incremental); only `migrate:fresh` / `reset:db` wipe.
- **🟢 Normal push** — everything else (frontend `apps/web`, config, docs, bug
  fixes). Publishing articles is data via `/admin`, no code.

## 3. Always give the exact commit message(s)

End every change with a ready-to-paste command, e.g.:

```bash
git add -A && git commit -m "<type>: <summary>" && git push
```

If a dependency changed, remind the user to run `pnpm install` and commit the
updated **root** `pnpm-lock.yaml` (CI uses `--frozen-lockfile` and will fail otherwise).

---

## Project context (quick reference)

- **Monorepo** (Turborepo + pnpm): `apps/web` (Next.js, Vercel, :3000),
  `apps/cms` (Payload, Railway, :3001), `apps/mobile` (Expo), `packages/*`.
- **DB:** PostgreSQL. Local dev → **Postgres in Docker** (`docker compose up -d`,
  default `DATABASE_URL` in `apps/cms/.env.example`); live → **Neon** (URL only in
  Railway's variables). There is no hosted dev database and no Railway dev
  environment any more — both were removed in Nov 2026. `pnpm seed` fills a
  local DB with an admin + sample articles (refuses any non-localhost DB).
- **Schema:** versioned **migrations** (`push: false`), not push mode. See
  `DEPLOYMENT.md` §5.
- **Auth:** Clerk (readers, web) · Payload auth (CMS editors).
- **Roles:** CMS users are admin / editor / writer (`apps/cms/src/access/roles.ts`:
  writers draft under their own author profile and can't publish). Readers
  (Clerk) get a `readers` row in the CMS with a role that is their badge
  (Owner: one account only, Admin, Moderator, Author, Reader), their saved
  articles (`bookmarks`) and followed games (`game-follows`), via
  `apps/cms/src/lib/readers.ts`. The web reaches it server to server with
  `READER_API_SECRET` after checking the Clerk session
  (`apps/web/src/lib/readers.ts`, `/api/bookmarks`, `/api/follows`,
  `/account`); Clerk's
  webhook (`/api/clerk/webhook`) syncs profiles and deletes on account deletion.
- **Comments:** `apps/cms/src/lib/comments.ts` (rules, moderation, reports to
  the Discord moderation channel `MODERATION_DISCORD_WEBHOOK_URL`) behind
  `/api/comments*` on the web (`components/Comments.tsx`). Kill switch:
  `/admin` → Community settings. Every write needs a verified email.
- **Languages (EN + FR):** pages live under
  `apps/web/src/app/[locale]`; English at the bare path, French under `/fr`
  (same slugs). Every interface string goes in `lib/i18n/messages/en.ts` and
  `fr.ts` (same keys, tested), never inline. Internal links: `import Link from
  '@/components/LocaleLink'` (never `next/link`), except `?page=` links, which
  are plain `<a>` built with `localHref` (`Pagination.tsx`, see PROGRESS
  gotchas). Dates: `<DateText>` or
  `lib/i18n/dates.ts` (🇬🇧 / 🇺🇸 / 🇫🇷). Server pages call
  `setRequestLocale((await params).locale)` then `getMessages()`; metadata uses
  `alternates(locale, path)` for canonical + hreflang. Client components use
  `useI18n()`. The proxy handles `/en` redirects and the first-visit language.
  Article text is translated in the CMS (`apps/cms/src/lib/translate.ts`, job
  `translateArticle` on publish / English change, `fr` group on Articles);
  the web swaps it in with `localizeArticle` (`lib/i18n/content.ts`) and shows
  English with a notice until it exists. Live showcase pages stay English
  until the live ends, then get translated once. RSS: `/feed.xml` and
  `/fr/feed.xml` (`lib/feed.ts`).
- **Page cache (ISR):** pages are cached (`revalidate = 300` for home and
  sections, `3600` for the rest, dropped at once by `/api/revalidate`). Never read `cookies()`, `headers()`, `searchParams`
  or a server Clerk helper in a page or the layout: it makes it per-request
  for everyone. Auth UI is client-side (`HeaderAuth`); list pages take `?page`
  as a path param (the proxy rewrites it, `list.tsx` + `page/[n]`); dynamic
  slugs export `generateStaticParams() { return [] }`.
- **Search:** `/api/search` queries the CMS (Postgres `ILIKE`) by default and
  switches to Meilisearch when `MEILISEARCH_HOST` is set (indexing hooks in the
  CMS). Meilisearch failures fall back to the CMS. Currently running on the
  fallback — Meilisearch Cloud has no free tier. The CMS path matches title,
  excerpt, game name and tag names (and the French versions); the header
  suggests games + articles as you type, `/search` shows the matching games
  first, then the articles, filters by section and game and highlights
  matches (`lib/search-query.ts`). Games are matched by name and initials in
  memory ("GTA" → Grand Theft Auto VI, `lib/game-match.ts`), and the articles
  about the best matches count as results.
- **SEO:** `/sitemap.xml` (every page, both languages) and `/news-sitemap.xml`
  (Google News: articles of the last 48 hours, `lib/news-sitemap.ts`), both in
  `robots.txt`; `NewsArticle` JSON-LD on articles, large image previews.
  Search Console / Publisher Center setup: `DEPLOYMENT.md` §6.8.
- **Games library:** `/games` filters every game by console, year, month,
  studio / publisher, genre, out / upcoming, letter (in the browser,
  `lib/game-library.ts`, filters in the URL). A game has *releases* (consoles
  + date + precision day / month / quarter / year / TBA, one row per group of
  consoles released together); `platforms` and `releaseDate` are computed
  from them, never edit those. Consoles are *Platforms* documents (since
  2026-11-18: slug, name, short label, family, position, aliases, release,
  tag), each with its page `/platform/<slug>`; a release links to them. The
  web gets the list from the CMS (`fetchAllPlatforms`) and passes it to
  `lib/platforms.ts` / `lib/game-library.ts` helpers. Studios and publishers
  are *Companies* with their page `/company/<slug>`. The scout fills all
  this from official news on *Publier* (`scout/game-facts.ts`), and creates
  a console the news names for the first time (a PS6 reveal: `consoles` in
  the draft and live tools, or a game announced on it); rumours never touch
  a game page.
  Readers reach console and company pages from game pages, the `/games`
  consoles row, the search (`searchEntities`, `lib/entity-match.ts`) and
  article tag chips that stand for one (`fetchTagPages`).
- **CI:** `.github/workflows/ci.yml` — lint web/CMS/mobile, type-check
  web/CMS/mobile/shared packages, unit tests (`pnpm test`: vitest in web,
  mobile, CMS and api-client), then build web + CMS (mobile isn't built — that needs EAS) and,
  on a throwaway Postgres: migrations from scratch, `pnpm seed`, CMS integration
  tests (`test:int`) and Playwright on the admin and the public site. Dependabot
  (`.github/dependabot.yml`) opens grouped update PRs weekly; React/RN/Expo are
  ignored on purpose (they move with Expo SDK upgrades). `.github/workflows/backup.yml` dumps the prod DB nightly
  to a private R2 bucket and pings healthchecks.io, which emails if a night is
  missed; a Cloudflare Worker (`infra/backup-trigger/`) triggers it on time
  because GitHub's cron runs hours late (`DEPLOYMENT.md` §9). Uses `pnpm install
  --frozen-lockfile` on Node 22.
- **Live:** web = `akavish.gg` (canonical apex; `www` 308s to it), CMS =
  `cms.akavish.gg`. DNS on Cloudflare; the platform URLs
  (`akavish-web-puce.vercel.app`, `akavish-production.up.railway.app`) still work
  but nothing should link to them. Mail via Cloudflare Email Routing
  (`hello@` / `tips@` / `privacy@`, receive-only).
- **Shared data mapping:** the Payload → `Article` mapper lives in
  `@akavish/api-client/payload` and is used by both web (`lib/payload.ts`) and
  mobile. Article categories and reading time are shared too:
  `packages/api-client/src/{categories,reading-time}.ts` (the web's `lib/`
  files re-export them); categories must match the CMS `category` options.
- **Mobile:** a reading app (tabs, article screen, sections), described in
  `apps/mobile/README.md`. Expo Router routes in `apps/mobile/app/`, the rest in
  `apps/mobile/src/` (relative imports). Same dark palette as the web
  (`src/theme.ts`). Pure helpers in `src/lib` have vitest tests.
- **Docker (fallback only):** `apps/web/Dockerfile`, `apps/cms/Dockerfile`, built
  from the repo root; `NEXT_OUTPUT=standalone` is set only there (Vercel/Railway
  unchanged). `DEPLOYMENT.md` §10.
- **Secrets:** rotation runbook and rotation log in `DEPLOYMENT.md` §8.
- **Costs:** `COSTS.md` lists what the site costs each month (paid, free with
  limits, coming). Update it whenever a paid service or a plan changes, or a
  real bill replaces an estimate.
- **Status / roadmap:** single source of truth is **`PROGRESS.md`**. Deployment
  runbook is **`DEPLOYMENT.md`**.
- **Media:** uploads go to Cloudflare R2 via `@payloadcms/storage-s3` (the CMS
  host's disk is ephemeral), served from `media.akavish.gg`. Set `R2_*` on the
  CMS; unset `R2_BUCKET` falls back to local disk. `alwaysInsertFields: true`
  keeps the media schema identical with or without R2: a migration generated
  without it once broke prod's media API. See `DEPLOYMENT.md` §4b and §5.
- **Email:** two separate things — the CMS **sends** via Resend
  (`@payloadcms/email-resend`, `RESEND_API_KEY` unset → console fallback,
  `DEPLOYMENT.md` §4c); Cloudflare Email Routing only **receives**
  (`DEPLOYMENT.md` §6.6).
- **AI scout:** `apps/cms/src/scout/`, the `scoutTick` job (every 5 min, queue
  `scout`, off unless `SCOUT_ENABLED=true`). Step 1 = observation: RSS → Haiku
  grouping + score → Discord digests at 8 am / 8 pm, budget caps. Step 2 =
  Sonnet **draft** articles (`aiAssisted`) validated on Discord by a bot
  (Publish / Edit → V2 / Reject, endpoint `/api/scout/discord`, `scoutDraft`
  job), automatic drafts off unless *Scout settings → draftsEnabled*. Never
  publish without the owner's click, nor without a cover: official source's
  `og:image`, else a still of an official video it links (not one a recent
  article about the game wears), else a fresh image of the game: never one of
  the covers of its last 10 articles, the one whose Haiku description fits the
  story (`game-images.ts`: the game's official images found online, IGDB with
  `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` then Steam, join its *Other images*
  once a week, 12 at a time, described by Haiku from the picture), else a
  press source's `og:image` credited to the outlet (Alex's call, 2026-11-26),
  else the game's image used least lately (`media.ts`). *Autre image* on the
  Discord card runs the same order without the current cover; editors run the
  look online for one game now with `POST /api/scout/game-images`;
  photos of people (esport) only with the owner's written OK and a **Credit**
  on the media (shown under the cover), never Liquipedia's (permission given
  to them, not us); esport cards say which photo to find (`photo_hint`);
  official YouTube videos go in a *Watch* section. Tags and game: the
  model picks existing ones and may create what's missing (at most 2 tags, a
  game only with its official title; cleaned up if the draft is rejected).
  Automatic drafts skip news already covered (`dedupe.ts`). Every field a draft fills: `DEPLOYMENT.md` §11. Event mode
  (`live.ts`): `/live` on Discord, one live article updated every 5 min,
  auto-published only after the editor's first click, recap drafted on stop;
  `test:True` = a rehearsal (drafts only, no game changes, deleted with a button);
  live and recap check the monthly budget only. Discord channels:
  `botIn(bot, 'live' | 'budget' | 'report')` (`SCOUT_DISCORD_*_CHANNEL_ID`,
  fallback the scout channel), table in `DEPLOYMENT.md` §11. Weekly report (`report.ts`): Discord on
  Saturdays, `GET /api/scout/report` for editors. Design and steps in
  `PROGRESS.md`, setup in `DEPLOYMENT.md` §11. Fetch as an identified
  bot only (no browser User-Agent), no Reddit, X through its paid API only.
- **Images:** `next/image` with `images.unoptimized` (no Vercel quota):
  pass the Payload size that fits (`coverImageCard` for cards, `coverImage`
  = hero for an article's top, `mediaUrl(m, 'square')` for avatars), never the
  original. PROGRESS gotchas.
- **Esport data** comes from PandaScore (`apps/cms/src/esport/`, free plan,
  `PANDASCORE_TOKEN`), never from Liquipedia pages (its terms forbid
  automated reads). `pandascore.ts` maps the API (pure, unit-tested),
  `sync.ts` saves `esport-matches` / `esport-tournaments` every 10 min. The
  site's `/esport/results`, `/esport/calendar`, `/esport/transfers` live in
  `app/[locale]/[category]/` (404 for any other section, `generateStaticParams`
  lists only esport so they stay cached); filters in `lib/esport.ts`.
  `/esport/<game>` and `/esport/transfers/<game>` (`[game]` segments,
  `dynamicParams = false`) filter by game through `ESPORT_GAME_SLUGS`; a new
  `/esport/<game>` list path also goes in the proxy's `LIST_PATH` (`?page=`).
- **Anti-spoil** (`lib/spoilers.ts`): hiding scores is CSS on
  `<html data-spoilers>` (set before paint by `RESTORE_SPOILERS` in the
  layout), never a server decision, so pages stay cached. A card that can
  give a result away gets `spoilerClasses(article.spoiler)` + `<SpoilerVeil>`;
  a score gets `.akv-score` / `.akv-mask` inside an `.akv-match` row (`.akv-live`
  while played, `.akv-won` / `.akv-lost` / `.akv-verdict` for who won); a
  bracket or standings go inside `<SpoilerZone>`. What is hidden is the
  reader's choice (2026-11-27, `SpoilerPrefs`, `components/SpoilerSettings.tsx`):
  `data-sp-off` / `data-sp-hide` on `<html>` for the parts, and
  `.akv-free` (`components/SpoilerScope.tsx`) for the games and followed-teams
  scope, read from each element's `spoilerData()` attributes. A new
  spoiler-prone element: the right class plus `spoilerData({ game, teams, match })`.
  Push notifications follow the same choices: the site copies them to the
  CMS (`notify.spoilerPrefs` via `/api/notify-settings`), `hidesResult` in
  `apps/cms/src/lib/esport-follows.ts` decides.
- **Tournament pages** (`/esport/tournaments`, `[key]` = a game or a
  PandaScore stage slug): data from `esport-tournaments.structure` (CMS sync,
  `refreshStructures`), layout in `lib/esport-tournaments.ts` (pure, tested on
  a real bracket in `lib/fixtures/`).
- **Competitions** (2026-11-27, `/esport/competitions`, `[key]` = a game or
  a competition slug like `cs2-pgl-major`): CMS `esport-leagues` /
  `esport-series` / `esport-teams`, filled hourly by
  `apps/cms/src/esport/competitions-sync.ts` (pure helpers in
  `competitions.ts`: editions, winners, the names an article uses), laid out
  by `lib/esport-competitions.ts`. An article's `esportLeagues` is ticked
  automatically (title and tags, else excerpt) and editable. Winners go
  through `ChampionReveal` (anti-spoil). Team and player pages come next on
  the same data (PROGRESS backlog).
- **Calendars** (2026-11-27): the events calendar `/conferences/calendar`
  (CMS `events`, `lib/events.ts`, `components/EventsCalendar.tsx`, times in
  the reader's zone) and the release calendar `/games/releases`
  (`lib/release-calendar.ts`, `components/ReleaseCalendar.tsx`, same data as
  `/games`), each a tab next to its section.
- **Esport follows and the bell**: CMS `src/lib/esport-follows.ts` (follows,
  notifications made by the sync and by article publishing), web
  `/api/esport-follows`, `/api/notifications`, `/api/notify-settings`, one
  shared follows store in the browser (`lib/esport-follows-store.ts`, never a
  request per button), `EsportFollowButton`, `NotificationBell`. Web push:
  CMS `src/lib/web-push.ts` (VAPID keys, off without them), web `/sw.js`
  (route, not a file: the app has no `public/`), `lib/push-client.ts`,
  `PushToggle`. A list
  of articles (sections, Transfers) uses `components/ArticlesByDate.tsx`:
  the 4 newest, then by date. The
  morning recap draft is `apps/cms/src/esport/recap.ts` (scout run, 8 am Paris),
  with each group / Swiss stage's standings computed from all its matches.
  Scout stories carry an *Esport kind*: `result` is never auto-drafted (the
  recap covers it; `qualification`, big events only, is), a `transfer` draft gets the `transfers` tag (Mercato),
  the only roster tag (`ROSTER_TAG_WORDS` blocks the model creating another).
- **Media sizes are WebP** (`Media.ts`, `MEDIA_SIZE_FORMAT`); the original
  stays as uploaded and the site never shows it. A new size gets
  `withoutEnlargement: true` and `formatOptions: MEDIA_SIZE_FORMAT`, then
  `scripts/media-webp.mjs` makes it for the existing images.
- **Vercel builds only for the site:** `apps/web/vercel.json` →
  `scripts/vercel-ignore.sh` skips a push that touches nothing under
  `apps/web`, `packages/` or the root package/lock files. A new path the web
  build depends on goes in that script's `git diff` list.
- **Site refresh:** the CMS pings the web's `POST /api/revalidate` after any
  public change (articles, games, tags, authors, companies, platforms, media
  edits;
  `lib/revalidate-web.ts` `tagsFor`) with the cache tags of what changed,
  `REVALIDATE_SECRET` identical on both apps. Every web CMS fetch goes through
  `cmsFetch` (`apps/web/src/lib/payload.ts`, `cms` tag) and picks a tag from
  `TAGS` (`lib/revalidate.ts`) plus a `CACHE` delay: lists `TAGS.articles`
  (5 min), one document its own tag (1 h), an entity page's articles
  `fetchArticles({ cacheTags })`. A new tag shape goes in both `TAGS`,
  `cleanTags` and `tagsFor`. Never flush everything on a save, except an
  image whose files change (`tagsFor` returns null): its old URLs are
  deleted and may be on any page.
- **Articles from Markdown:** `apps/cms/scripts/publish-articles.mjs` posts
  articles (covers, games, publish now / schedule / draft, optional
  backdated `publishedAt` for archives, `relatedGames`, review `score`, site links
  `[**Name**](/game/slug)`) over REST with a
  dedicated editor login in the gitignored `.cms-import`; scheduling goes
  through `POST /api/articles-schedule` (same job as the admin button).
  AI-drafted pieces always carry `aiAssisted`. Lists of games with dates
  start with the game in bold, then ` · ` and the short English date:
  `**Metro 2039** · Feb 4 (PS5, PC). …` (`February`, `Late 2027` without a
  day); never the date first. The scout's drafts follow the same rule.
- **Newsletter:** double opt-in sign-up, rules in `apps/cms/src/lib/newsletter.ts`
  (endpoints `/api/newsletter/*`, collection `subscribers`, int tests), web form
  `components/NewsletterSignup.tsx` → `app/api/newsletter` (rate-limited) and
  pages `/newsletter/confirm|unsubscribe`. The privacy policy (EN + FR) states
  these rules: change one, change the other. Sending issues isn't built
  (`PROGRESS.md` 🅿️).
- **Logs / limits:** server logs go through `apps/web/src/lib/log.ts` (JSON
  lines; never log IPs or search terms); public API routes use
  `lib/rate-limit.ts` (per-IP limit + CDN cache headers). `DEPLOYMENT.md` §4e.
- **Observability:** Vercel Web Analytics (`<DeferredAnalytics />` in the web layout, mounted after `load`,
  cookieless → no consent banner) + Sentry on both apps. Unset DSN → no-op. Web
  tunnels through `/monitoring` to survive ad blockers (excluded from the Clerk
  matcher and `robots.ts`); the CMS is server-side only. UptimeRobot probes
  `akavish.gg` and the CMS API (Keyword monitor: Payload 404s on `HEAD`).
  `DEPLOYMENT.md` §4d.
- **Adding/removing a Payload plugin or an admin component** (`src/components/admin/`): always run `pnpm generate:importmap` in
  `apps/cms` and commit the result — a stale `importMap.js` makes the admin panel
  render a blank page.
- **Known gotchas** (details in `PROGRESS.md` → gotchas):
  `.npmrc` is gitignored, so CI/Vercel/Railway install without hoisting;
  Node 22 LTS ≥ 22.13 (Expo 58 needs it;
  25 OOMs the CMS); **pnpm 10** pinned via `packageManager` — `overrides` in
  `pnpm-workspace.yaml` are security pins for transitive deps only (same major,
  `^x.y.z`); never add React there (Expo pins its own exact React, 19.3 on
  SDK 58, while Next/Payload are on 19.2). Mobile = **Expo SDK 58**; on iPhone, Expo Go needs the same
  Expo account signed in on phone and computer. Accessibility: small text on the
  dark background is `text-zinc-400` or lighter (never `zinc-500/600`), card
  images get `alt=""`, French pages pass `lang="fr"` to `ContentPage`. Light
  theme: keep writing the dark Tailwind classes (they're CSS variables that
  flip), never raw hex; green-button text is `text-on-accent`. Tailwind 4
  (since 2026-11-23): no `tailwind.config.ts`, the theme is the `@theme inline`
  block in `apps/web/src/app/globals.css`; v4 names (`shadow-xs`,
  `rounded-sm`, `outline-hidden`…) and `space-y-*` puts its margin under each
  child, so a child's own `mt-*` now counts.
