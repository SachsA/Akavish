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
- **Search:** `/api/search` queries the CMS (Postgres `ILIKE`) by default and
  switches to Meilisearch when `MEILISEARCH_HOST` is set (indexing hooks in the
  CMS). Meilisearch failures fall back to the CMS. Currently running on the
  fallback — Meilisearch Cloud has no free tier. The CMS path matches title,
  excerpt, game name and tag names; the header suggests games + articles as you
  type, `/search` filters by section and game and highlights matches
  (`lib/search-query.ts`).
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
  `og:image`, else a still of an official video it links, else the game's
  cover or one of its *Other images* (the least used in 14 days, so a game in
  the news daily doesn't repeat one picture), never a press outlet's image (`media.ts`);
  official YouTube videos go in a *Watch* section. Tags and game: the
  model picks existing ones and may create what's missing (at most 2 tags, a
  game only with its official title; cleaned up if the draft is rejected).
  Automatic drafts skip news already covered (`dedupe.ts`). Every field a draft fills: `DEPLOYMENT.md` §11. Event mode
  (`live.ts`): `/live` on Discord, one live article updated every 5 min,
  auto-published only after the editor's first click, recap drafted on stop. Weekly report (`report.ts`): Discord on
  Saturdays, `GET /api/scout/report` for editors. Design and steps in
  `PROGRESS.md`, setup in `DEPLOYMENT.md` §11. Fetch as an identified
  bot only (no browser User-Agent), no Reddit, X through its paid API only.
- **Site refresh:** the CMS pings the web's `POST /api/revalidate` after any
  public change (articles, games, tags, authors; `lib/revalidate-web.ts`),
  `REVALIDATE_SECRET` identical on both apps. Every web CMS fetch carries the
  `cms` tag (`cmsFetch` in `apps/web/src/lib/payload.ts`); a new CMS read must
  go through `cmsFetch` to be refreshed.
- **Articles from Markdown:** `apps/cms/scripts/publish-articles.mjs` posts
  articles (covers, games, publish now / schedule / draft, optional
  backdated `publishedAt` for archives, `relatedGames`, review `score`, site links
  `[**Name**](/game/slug)`) over REST with a
  dedicated editor login in the gitignored `.cms-import`; scheduling goes
  through `POST /api/articles-schedule` (same job as the admin button).
  AI-drafted pieces always carry `aiAssisted`.
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
- **Adding/removing a Payload plugin:** always run `pnpm generate:importmap` in
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
  flip), never raw hex; green-button text is `text-on-accent`.
