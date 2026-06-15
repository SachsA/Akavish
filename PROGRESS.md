# Akavish — Progress Log

A running record of what's built, what's in progress, and what's next.
The top half is what's **done**; the [Backlog](#backlog--everything-left-to-do)
near the bottom is the full list of everything still to do (pages, back-office,
search, infra, CI, deployment, legal…). Last updated: **2026-06-03**.

Legend: ✅ done · 🚧 in progress · ⬜ not started

---

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
| ✅ | Root `README.md` | Stack, structure, ports, two-terminal dev flow, roadmap |
| ✅ | `apps/cms/README.md` | Akavish-specific (was the Payload blank template) |
| ✅ | `.env.example` files | web (Clerk + CMS_URL), cms (Postgres + URLs) |
| ✅ | `.gitignore` | Secrets (`.env*`, `/.clerk/`), payload-types, media — verified ignored |
| ✅ | Reset scripts | `pnpm clean` (build + deps) · `pnpm reset:db` (also wipes Postgres) |
| ✅ | `PROGRESS.md` | This file |

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

✅ **Done** — sitemap, robots, per-article OG images, JSON-LD, canonical URLs,
and CMS `seo` fields are all wired (see the SEO block in the done section above).

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
| P1 | Versioned migrations | Currently push mode. Generate real migrations (`payload migrate:create`) before production |
| P2 | Seed script | Script to create an admin user + sample content for fresh installs |
| P2 | Backups | Automated DB backups (Neon has PITR; document the policy) |

## 4. Search (Meilisearch)

✅ **Done** — indexing hooks, backfill script, `/api/search` proxy, header search
box + `/search` page, and a dev `docker-compose` are all wired (see the Search
block in the done section above).

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
| Pri | Item | Notes |
|-----|------|-------|
| P1 | Lint + type-check on PR | `pnpm lint`, `tsc --noEmit` across workspaces |
| P1 | Build on PR | `pnpm build` (catch broken builds before merge) |
| P2 | Run tests | CMS has Vitest (int) + Playwright (e2e) configured — run them in CI |
| P2 | Preview deploys | Vercel preview per PR |
| P3 | Dependabot / renovate | Dependency updates |

### Deployment (production)
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
- The web app currently uses raw `<img>` tags — switch to `next/image` and
  configure allowed remote hosts before launch.
- `pnpm reset:db` needs the **`psql`** client installed locally.
