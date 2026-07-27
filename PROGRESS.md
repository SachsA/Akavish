# Akavish — Progress Log

**The single source of truth for project status.** The README explains *what the
project is and how to run it*; this file tracks *what's done and what's left*.

- **[Done](#done)** — everything built so far, grouped by area.
- **[In progress / next up](#in-progress--next-up)** — what's active right now.
- **[Backlog](#backlog--everything-left-to-do)** — the full prioritized to-do
  list (pages, back-office, deployment, legal, mobile…).

Legend: ✅ done · 🚧 in progress · ⬜ not started ·
priorities **P1** (before launch) / **P2** (soon after) / **P3** (nice-to-have).

Last updated: **2026-07-27**.

---

# Done

## Foundations

| Status | Item | Notes |
|--------|------|-------|
| ✅ | Monorepo (Turborepo + pnpm workspaces) | `apps/web`, `apps/cms`, `apps/mobile`, `packages/*` |
| ✅ | Shared `types` package | `Article`, `Game`, `Author`, pagination, API error types |
| ✅ | Shared `api-client` package | Talks to the Payload REST API (web + mobile) |
| ✅ | Shared `ui` package | Common React components |
| ✅ | Node version pinned | `.nvmrc` → 22 LTS (Node 25+ caused OOM crashes) |

## CMS (Payload, port 3001)

| Status | Item | Notes |
|--------|------|-------|
| ✅ | Payload 3 standalone app | Admin UI + REST/GraphQL API |
| ✅ | PostgreSQL adapter (Neon) | Replaced the template's default Mongo config |
| ✅ | Collections | articles, authors, games, tags, media, users |
| ✅ | Article model | rich-text (Lexical), category, status, author/game/tags, SEO |
| ✅ | Drafts + versions on articles | Draft / Published / Archived |
| ✅ | Auto-slugs on all collections | `slugField` (auto from name/title if empty, manual-editable, `-2/-3…` on clash) now on articles, authors, games, tags |
| ✅ | Public read access control | Articles: published-only for public; editors see all. Authors/games/tags/media: public read |
| ✅ | Dev script fixed | `-p 3001` + `--max-old-space-size=8000` on `dev`/`devsafe` |
| ✅ | `serverURL` / CORS / CSRF | serverURL → :3001, CORS/CSRF allow web origin :3000 |

## Web (Next.js, port 3000)

| Status | Item | Notes |
|--------|------|-------|
| ✅ | Wired to the CMS | `src/lib/payload.ts` fetches + maps Payload docs → shared `Article` |
| ✅ | `/api/articles` route | Proxies published articles from the CMS |
| ✅ | `/api/articles/[slug]` route | Single published article by slug (Next 15 async `params`) |
| ✅ | Home page feed | Real published articles, with empty + CMS-unreachable states |
| ✅ | `ArticleCard` component | Cover, category, date, excerpt, author |
| ✅ | Article detail page `/article/[slug]` | Renders Lexical content, SEO metadata, OG tags |
| ✅ | Lexical → React renderer | `LexicalContent.tsx` (headings, lists, quotes, links, inline formats) |
| ✅ | Category pages `/[category]` | news, leaks, reviews, esport, previews, conferences |
| ✅ | Author pages `/author/[slug]` | Profile (avatar, bio, twitter) + their published articles |
| ✅ | Game pages `/game/[slug]` | Game metadata (cover, platform, genre, dev/publisher) + coverage |
| ✅ | Tag pages `/tag/[slug]` | Articles filtered by tag |
| ✅ | Cross-links | Article byline → author/game; tag chips → tag pages |
| ✅ | Custom 404 / error pages | `not-found.tsx`, `error.tsx`, `global-error.tsx` |
| ✅ | Functional footer | Sections, About/Contact/Legal, RSS, socials — all targets now exist |
| ✅ | Footer pages | `/about`, `/contact`, `/privacy`, `/terms` (legal pages are review-me templates) |
| ✅ | RSS feed `/feed.xml` | Route handler, latest 50 published articles |
| ✅ | Loading states | `loading.tsx` + `CardGridSkeleton` on home, category, article, author, game, tag |
| ✅ | `next/image` everywhere | Replaced raw `<img>`; media URLs absolutised; CMS host allowed via `remotePatterns` |
| ✅ | `tsconfig` baseUrl fix | `@/*` alias now resolves reliably at build |

### SEO
| Status | Item | Notes |
|--------|------|-------|
| ✅ | Site config + `metadataBase` | `lib/site.ts` reads `NEXT_PUBLIC_SITE_URL`; layout sets metadataBase + default canonical |
| ✅ | `sitemap.xml` | `app/sitemap.ts` — static pages + categories + all published articles/authors/games/tags |
| ✅ | `robots.txt` | `app/robots.ts` — allows all but `/api`, `/account`, `/sign-in`, `/sign-up`; links sitemap |
| ✅ | Canonical URLs | `alternates.canonical` on home, article, category, author, game, tag |
| ✅ | CMS `seo` fields used | Article metadata prefers `seo.title` / `seo.description`, falls back to title/excerpt |
| ✅ | Dynamic OG images | `app/article/[slug]/opengraph-image.tsx` via `next/og` (branded, per-article) |
| ✅ | JSON-LD | `NewsArticle` structured data on article pages |

### Search (Meilisearch)
| Status | Item | Notes |
|--------|------|-------|
| ✅ | CMS indexing | `meilisearch` client + `afterChange`/`afterDelete` hooks on Articles (published → upsert, else remove); best-effort |
| ✅ | Backfill script | `pnpm reindex:search` (CMS) re-creates index settings + indexes all published articles |
| ✅ | Search API | `app/api/search/route.ts` proxies queries server-side; key never exposed |
| ✅ | Search UI | Header `SearchBar` + `/search` results page (robots: noindex) |
| ✅ | Local infra | `docker-compose.yml` runs Meilisearch on :7700; env wired in both `.env.example` |

## Auth

| Status | Item | Notes |
|--------|------|-------|
| ✅ | Clerk for readers (web) | `ClerkProvider`, middleware, header Log in / Sign up, `UserButton` |
| ✅ | Sign-in / sign-up pages | `/sign-in`, `/sign-up` (+ modal mode in header) |
| ✅ | Editor auth | Stays on Payload (CMS admin), separate from readers |
| ⬜ | Protected reader area `/account` | Middleware matcher is ready; page not built yet |
| ⬜ | Sync Clerk users → CMS / DB | For comments, favorites, etc. |

## Mobile (Expo)

| Status | Item | Notes |
|--------|------|-------|
| ✅ | Expo app consuming same API | Shares `api-client` + `types` |
| ⬜ | Clerk on mobile | Reader auth parity with web |
| ⬜ | Push notifications | Expo |

## Docs & config

| Status | Item | Notes |
|--------|------|-------|
| ✅ | Root `README.md` | Stack, structure, ports, install/dev flow, CI — points here for status |
| ✅ | `apps/cms/README.md` | Akavish-specific (was the Payload blank template) |
| ✅ | `.env.example` files | web (Clerk + CMS_URL + Meili + SITE_URL), cms (Postgres + URLs + Meili) |
| ✅ | `.gitignore` | Secrets (`.env*`, `/.clerk/`), payload-types, media — verified ignored |
| ✅ | Reset scripts | `pnpm clean` (build + deps) · `pnpm reset:db [URL]` (wipe any Postgres DB — dev by default or prod by URL; no psql, uses `pg`) |
| ✅ | `PROGRESS.md` | This file |

## CI/CD

| Status | Item | Notes |
|--------|------|-------|
| ✅ | GitHub Actions CI | `.github/workflows/ci.yml` on push to `main` + every PR |
| ✅ | Lint + type-check job | `pnpm lint` + `pnpm type-check` (web + CMS; mobile excluded) |
| ✅ | Build job | `pnpm build` (web + CMS) with a Postgres service + dummy env |
| ✅ | ESLint flat configs | web + cms use `eslint.config.mjs` importing `eslint-config-next`'s native flat presets (no FlatCompat, no `next lint`); web bumped to `eslint-config-next@16` |
| ✅ | Link hygiene | Internal `<a>` → `next/link` `<Link>` across web (fixes `no-html-link-for-pages`) |
| ✅ | `type-check` scripts | Added to root (turbo) and CMS |
| ✅ | pnpm 10 fix | Moved `overrides` + `onlyBuiltDependencies` to `pnpm-workspace.yaml` (pnpm 10 ignores the `pnpm` package.json field) |

## Deployment (prep)

| Status | Item | Notes |
|--------|------|-------|
| ✅ | Deployment guide | `DEPLOYMENT.md` — web→Vercel, CMS→Railway/Render, Neon, search, domains, checklist + env reference |
| ✅ | Migration scripts | CMS `pnpm migrate` / `migrate:create` / `migrate:status` added (ready to leave push mode) |
| ⬜ | Actually deploy | Follow `DEPLOYMENT.md` — needs your Vercel/Railway/Neon/Clerk-prod accounts |

---

# In progress / next up

| Status | Item | Notes |
|--------|------|-------|
| ✅ | **Deploy — Phase 1 (live on platform URLs)** | CMS on Railway (`akavish-production.up.railway.app`) + web on Vercel (`akavish-web-puce.vercel.app`), both serving real content. Prod Neon DB. |
| 🚧 | Finish Phase 1 wiring | Set `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_APP_URL` (Vercel) + `WEB_URL` (Railway) to the live URLs, redeploy. |
| ⬜ | **Phase 2 — custom domain** | Once `akavish.gg` is bought: add domains in Vercel + Railway, DNS, swap the URL env vars, switch Clerk to prod keys. |
| ⬜ | **Media on R2** | Uploaded images 404 in prod (CMS disk is ephemeral on Railway) until Cloudflare R2 storage is wired — see Backlog §3. |

---

# Backlog — everything left to do

Grouped by area. Rough priority: **P1** = needed before a public launch ·
**P2** = strongly wanted soon after · **P3** = nice-to-have / later.

## 1. Website (public frontend — `apps/web`)

### Pages & navigation
| Pri | Item | Notes |
|-----|------|-------|
| P1 | Single article polish | Reading time, share buttons, related articles, prev/next (author/game byline links ✅ done) |
| P2 | Legal content review | `/privacy` and `/terms` are placeholder templates — need real legal text before launch |
| P2 | Pagination / infinite scroll | Home + category + tag pages currently cap at N items |
| P2 | Homepage layout pass | Featured/hero article, “trending”, section blocks instead of one flat grid |
| P2 | Newsletter signup | Capture emails (needs an ESP: Resend/Mailchimp/etc.) |
| P3 | Search polish | Highlighting, filters by category, instant/typeahead results |
| P3 | Dark/light toggle | Currently dark-only |
| P3 | Comments | Reader comments (needs reader auth + a comments store/service) |

### UX & quality
| Pri | Item | Notes |
|-----|------|-------|
| P2 | Mobile responsive audit | Verify header nav, cards, article/game/author pages on small screens |
| P2 | Accessibility pass | Alt text, focus states, color contrast, keyboard nav, semantic landmarks |
| P3 | Analytics | Plausible / GA / Vercel Analytics |

## 2. SEO

Core SEO is done (see the [Done → SEO](#seo) section). Remaining:

| Pri | Item | Notes |
|-----|------|-------|
| P2 | OG images for non-article pages | Author/game/tag/category `opengraph-image` (article done) |
| P3 | Breadcrumb JSON-LD | `BreadcrumbList` schema on detail pages |
| P3 | Per-locale hreflang | Only once i18n lands (area 6) |

## 3. CMS / back-office (`apps/cms`)

### Content modeling
| Pri | Item | Notes |
|-----|------|-------|
| P1 | Required SEO defaults | Auto-fill `seo.title`/`description` from title/excerpt via a hook if empty |
| P1 | Author ↔ user link | Connect a CMS `user` (editor) to an `author` profile |
| P2 | Editorial workflow | Roles (admin / editor / writer) + access control per role; review/publish flow |
| P2 | Scheduled publishing | Publish at a future `publishedAt` (cron or Payload job) |
| P2 | Homepage curation | A “featured” flag or a singleton “Homepage” global to pick the hero |
| P2 | Redirects collection | Manage slug changes without breaking links (`@payloadcms/plugin-redirects`) |
| P3 | i18n fields | Localized title/content if going bilingual (area 6) |
| P3 | Related games/series taxonomy | Beyond single `game` relation |

### Media & storage
| Pri | Item | Notes |
|-----|------|-------|
| P1 | Cloudflare R2 storage adapter | Wire `@payloadcms/storage-s3` to R2; env vars already stubbed in `.env` |
| P1 | Image sizes / focal point | Define `imageSizes` on the `media` collection for responsive cards |
| P2 | Alt text required on media | Accessibility + SEO |

### Operational
| Pri | Item | Notes |
|-----|------|-------|
| P1 | Email adapter | Currently logs to console — add `@payloadcms/email-nodemailer` (Resend/SES) for password resets, etc. |
| P1 | Versioned migrations | `push: true` is currently **forced in all envs** (incl. prod) in `payload.config.ts` so fresh DBs self-create the schema. Scripts ready (`pnpm migrate:create` / `migrate`). Before real content: set `push: false`, generate + commit the initial migration, run `pnpm migrate` on deploy — see `DEPLOYMENT.md` §5 |
| P2 | Seed script | Script to create an admin user + sample content for fresh installs |
| P2 | Backups | Automated DB backups (Neon has PITR; document the policy) |

## 4. Search (Meilisearch)

Core search is done (see the [Done → Search](#search-meilisearch) section). Remaining:

| Pri | Item | Notes |
|-----|------|-------|
| P2 | Hosted Meilisearch for prod | Meilisearch Cloud or self-hosted; set prod host + keys |
| P3 | Search-only API key | Generate a scoped key in prod instead of reusing the master key |
| P3 | Typeahead / filters | Instant results in the header, filter by category/game |

## 5. Auth & reader features

| Pri | Item | Notes |
|-----|------|-------|
| P2 | `/account` page | Profile, saved articles (middleware matcher already in place) |
| P2 | Clerk → DB sync | Webhook to mirror Clerk users into Postgres for app data |
| P2 | Clerk on mobile | Reader auth parity in the Expo app |
| P3 | Saved/bookmarked articles | Per-user, needs the DB link above |
| P3 | Social login providers | Configure Google/Discord/etc. in Clerk |

## 6. Internationalization (EN + FR)

| Pri | Item | Notes |
|-----|------|-------|
| P3 | Frontend i18n | `next-intl` or App Router locale segments (`/en`, `/fr`) |
| P3 | Localized content | Payload localization on article fields |
| P3 | Locale switcher | Header control + `hreflang` tags |

## 7. Mobile (`apps/mobile`)

| Pri | Item | Notes |
|-----|------|-------|
| P1 | Upgrade Expo to SDK 53 (React 19) | Mobile is on Expo 52 / React 18 while web+cms are React 19. A repo-wide `react: 19` override forces RN onto React 19 (unsupported on SDK 52). Mobile is currently **excluded from the CI type-check** (`--filter=!@akavish/mobile`) until it's on a React-19 Expo SDK |
| P1 | Fix api-client ↔ Payload shape | `articlesApi.list` is typed `PaginatedResponse` (`.data`) but hits Payload's REST which returns `{docs,…}` — mobile's `res.data` is undefined at runtime. Align the shared client with the web's `lib/payload.ts` mapping |
| P2 | Feature parity audit | Home, category, article detail consuming the CMS API |
| P2 | Push notifications | Expo notifications on new articles |
| P3 | App store assets | Icons, splash, screenshots, listing copy |
| P3 | EAS build & submit | iOS + Android pipelines |

## 8. Infrastructure, CI/CD & deployment

### Docker
| Pri | Item | Notes |
|-----|------|-------|
| P2 | Dockerfile for web | Multi-stage Next.js build |
| P2 | Dockerfile for CMS | Payload already ships a starter `apps/cms/Dockerfile` — adapt it |
| P2 | Extend root `docker-compose` | Now runs Meilisearch ✅; add web + CMS + Postgres for a full one-command dev stack |

### CI (GitHub Actions or similar)

Lint + type-check + build on PR are done (see [Done → CI/CD](#cicd)). Remaining:

| Pri | Item | Notes |
|-----|------|-------|
| P2 | Lint + type-check mobile | Give the Expo app a working ESLint config + re-include it in CI once it's on a React-19 Expo SDK |
| P2 | Run tests in CI | CMS has Vitest (int) + Playwright (e2e) — wire them into the workflow |
| P2 | Preview deploys | Vercel preview per PR |
| P3 | Dependabot / renovate | Dependency updates |

### Deployment (production)

📄 Full runbook: **[`DEPLOYMENT.md`](./DEPLOYMENT.md)**. The steps below are the
checklist it walks through.

| Pri | Item | Notes |
|-----|------|-------|
| P1 | Host the web app | Vercel (recommended for Next.js) |
| P1 | Host the CMS | Needs a long-running Node host (Railway / Render / Fly / VPS) — **not** static. Set `SERVER_URL`, `WEB_URL`, prod `DATABASE_URL`, `PAYLOAD_SECRET` |
| P1 | Production database | Neon/Supabase prod branch, separate from dev |
| P1 | Domain + DNS | `akavish.gg` (web), e.g. `cms.akavish.gg` (CMS), `media.akavish.gg` (R2) |
| P1 | HTTPS + prod env vars | TLS on all hosts; real Clerk prod keys; prod `CMS_URL` on the web |
| P2 | CDN / caching | Cache headers + ISR tuning; R2/Cloudflare in front of media |
| P2 | Mobile release | Expo EAS build + store submission |
| P3 | Staging environment | Mirror of prod for QA |

## 9. Observability, security & legal

| Pri | Item | Notes |
|-----|------|-------|
| P1 | Error monitoring | Sentry (web + CMS) |
| P1 | Secrets management | Move from `.env` files to the host's secret store in prod |
| P2 | Rate limiting | On public API routes |
| P2 | Uptime monitoring | Healthcheck + alerting on web/CMS |
| P2 | Legal pages | Privacy policy, terms, cookie notice (needed for Clerk/analytics/GDPR) |
| P2 | Cookie consent | If using analytics/tracking in the EU |
| P3 | Logging | Structured logs shipped somewhere queryable |

## 10. Testing & docs

| Pri | Item | Notes |
|-----|------|-------|
| P2 | Web tests | The CMS has tests; the web app has none yet (unit + a couple of e2e) |
| P2 | API contract checks | Guard the Payload→web mapping in `lib/payload.ts` against schema drift |
| P3 | Contributor docs | How to add a collection, a page, run tests |
| P3 | Architecture diagram | One picture of web ↔ CMS ↔ DB ↔ services |

---

## Known notes / gotchas

- Run the CMS and web as **two separate processes** (ports 3001 and 3000).
- Articles must be **Published** to appear publicly; drafts are editor-only.
- Stick to **Node 20/22 LTS** — Node 25 ran the CMS out of heap memory.
- New CMS collections default to **private** reads — add `access.read` if the
  frontend needs them.
- The CMS runs Payload in **push mode** (no migrations). Generate real
  migrations before deploying to production.
- `pnpm reset:db` needs the **`psql`** client installed locally.
- **React types / `shamefully-hoist`:** the repo's `.npmrc` flattens deps into
  the root `node_modules`, so the mobile app's `@types/react@18` lands at
  `node_modules/@types/react` and `tsc` would pick it up for web/cms (React 19),
  causing bogus "Suspense/ClerkProvider cannot be used as a JSX component" and
  "bigint not assignable to ReactNode" errors. Fixed by `paths` overrides in
  `apps/web/tsconfig.json` and `apps/cms/tsconfig.json` that pin `react` /
  `react-dom` type resolution to each app's own React 19 copy. Don't remove
  those `paths` entries.
