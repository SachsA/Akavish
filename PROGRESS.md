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
| ✅ | `tsconfig` baseUrl fix | `@/*` alias now resolves reliably at build |

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
| P1 | Single article polish | Reading time, share buttons, related articles, prev/next, author byline with link |
| P1 | Author pages `/author/[slug]` | Author bio + their articles. Header/footer links to them |
| P1 | Game pages `/game/[slug]` | All articles about a game + game metadata |
| P1 | Tag pages `/tag/[slug]` | Browse by tag |
| P1 | Custom 404 / error pages | `not-found.tsx`, `error.tsx`, `global-error.tsx` with brand styling |
| P1 | Footer links that work | About, Contact, Legal, RSS, social — currently just a copyright line |
| P2 | Pagination / infinite scroll | Home + category + tag pages currently cap at N items |
| P2 | Homepage layout pass | Featured/hero article, “trending”, section blocks instead of one flat grid |
| P2 | Search UI | Search bar + results page (depends on Meilisearch, area 4) |
| P2 | Newsletter signup | Capture emails (needs an ESP: Resend/Mailchimp/etc.) |
| P3 | Dark/light toggle | Currently dark-only |
| P3 | RSS / Atom feed | `/feed.xml` generated from published articles |
| P3 | Comments | Reader comments (needs reader auth + a comments store/service) |

### UX & quality
| Pri | Item | Notes |
|-----|------|-------|
| P1 | Loading & skeleton states | `loading.tsx` per route; graceful CMS-down fallback everywhere |
| P1 | Image optimization | Use `next/image` (replace raw `<img>`); configure `images.remotePatterns` for R2/CMS host |
| P1 | Mobile responsive audit | Verify header nav, cards, article page on small screens |
| P2 | Accessibility pass | Alt text, focus states, color contrast, keyboard nav, semantic landmarks |
| P3 | Analytics | Plausible / GA / Vercel Analytics |

## 2. SEO

| Pri | Item | Notes |
|-----|------|-------|
| P1 | `sitemap.xml` | Dynamic from published articles + static pages (`app/sitemap.ts`) |
| P1 | `robots.txt` | `app/robots.ts` |
| P1 | Per-article OG/Twitter images | Static or generated via `next/og` (`opengraph-image`) |
| P1 | JSON-LD structured data | `Article` / `NewsArticle` schema on detail pages |
| P2 | Canonical URLs | Across web + any duplicate paths |
| P2 | Use article `seo` fields | The CMS already has `seo.title` / `seo.description` — wire them into metadata |

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

| Pri | Item | Notes |
|-----|------|-------|
| P2 | Run Meilisearch | Local (Docker) + a hosted instance for prod |
| P2 | Index on publish | Payload `afterChange`/`afterDelete` hooks sync articles to the index |
| P2 | Initial backfill script | Index all existing published articles |
| P2 | Search API + UI | `/api/search` proxy + results page on the web |

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
| P2 | `docker-compose` (dev) | Web + CMS + Postgres + Meilisearch in one `up` (CMS has a Mongo-based one to replace) |

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
