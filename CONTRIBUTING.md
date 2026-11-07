# Contributing to Akavish

How to make the usual changes without breaking production. Setup and day-to-day
commands are in the [README](./README.md); what's done and what's next is in
[PROGRESS.md](./PROGRESS.md); the standing rules for AI assistants (which apply
to humans too) are in [CLAUDE.md](./CLAUDE.md).

## The loop

```bash
docker compose up -d                 # local Postgres (+ Meilisearch)
cd apps/cms && pnpm migrate && cd ../..
pnpm seed                            # admin + sample articles, local DB only
```

Then two terminals (separate processes; root `pnpm dev` would also start Expo):

```bash
cd apps/cms && pnpm devsafe          # CMS + admin on :3001
cd apps/web && pnpm dev              # site on :3000
```

Before pushing, run what CI runs:

```bash
pnpm lint && pnpm type-check && pnpm test && pnpm build
cd apps/cms && pnpm test:int         # needs the local DB migrated
```

Then commit to `main` and push. CI (`.github/workflows/ci.yml`) re-runs all of
it plus the CMS e2e tests; Vercel and Railway deploy on their own once it's in.

## Adding or changing a CMS field / collection

Anything that changes the **database shape** (a field, its type, a new
collection, a relationship, an index) needs a migration. Production never
"pushes" the schema: Railway runs `pnpm migrate` before each deploy.

1. Edit the collection in `apps/cms/src/collections/` (new collection → also
   register it in `payload.config.ts`).
2. New collection the website must read? Add `access.read`: collections are
   private by default.
3. Generate and apply the migration, then commit it with the code:
   ```bash
   cd apps/cms
   pnpm migrate:create <short_name>   # writes src/migrations/<date>_<name>.ts + .json
   pnpm migrate                       # apply locally
   ```
   Unsure whether a change touches the DB? `pnpm migrate:create check`: an
   empty up/down means no; delete it.
4. If the web or mobile app needs the field, add it to the shared mapper
   `packages/api-client/src/payload.ts` (and `packages/types`) with a test in
   `payload.test.ts`. Never import `apps/cms/src/payload-types.ts` from code
   that CI type-checks: it's generated and gitignored.
5. Changed the article categories? They must match
   `apps/web/src/lib/categories.ts`; a unit test fails if they drift.
6. Added or removed a Payload **plugin**? Run `pnpm generate:importmap` and
   commit the result, or the admin panel renders blank.

## Adding a page to the website

Pages live in `apps/web/src/app/` (Next.js App Router).

- **Data:** fetch through `src/lib/payload.ts` (it already filters to
  published articles and maps them). Secondary data must fail soft: catch and
  drop it rather than 500.
- **Empty / error states:** use `components/StatusMessage.tsx`. Never show
  readers operational details (hostnames, "is the CMS running?").
- **SEO:** `generateMetadata` with a `canonical`; add the URL pattern to
  `app/sitemap.ts`; structured data through `components/JsonLd.tsx`
  (`breadcrumbList()` for detail pages).
- **No `loading.tsx`** on pages that can 404 or redirect (articles, lists):
  it makes Next stream the page, and `notFound()` / redirects then answer 200.
  Only the home has one (`app/(home)/loading.tsx`, mirrors the home layout).
- **Lists** paginate with `lib/pagination.ts` + `components/Pagination.tsx`
  (`?page=N`, 404 past the last page).
- **Accessibility** (the bar the #20 audit set): small text is `text-zinc-400`
  or lighter, never `zinc-500/600`; white on green buttons needs
  `bg-emerald-700`; one `h1`, then `h2` → `h3` in order; images that sit next to
  their own title get `alt=""`; French content passes `lang="fr"`.
- **Light and dark themes:** use the same dark-theme classes as the rest of
  the site (`bg-zinc-950`, `text-white`, `text-zinc-400`, `text-emerald-400`…):
  they're CSS variables that flip in light mode. Never hard-code a colour, and
  put `text-on-accent` (not `text-white`) on green buttons. Check both themes:
  the sun/moon button in the header switches.
- **A new third-party service that sees visitors?** Add it to
  `src/lib/legal.ts` (`PROCESSORS`) in the same commit: both privacy pages
  render that list.

## Tests

| Where | What | Command |
| --- | --- | --- |
| `apps/web/src/lib/*.test.ts` | Pure logic: reading time, categories, homepage lead, JSON-LD | `pnpm test` |
| `packages/api-client/src/*.test.ts` | The Payload → `Article` mapper | `pnpm test` |
| `apps/cms/tests/int/` | Payload against a real DB: slugs, publish date, redirects, access | `cd apps/cms && pnpm test:int` |
| `apps/cms/tests/e2e/` | Playwright through the admin panel | `cd apps/cms && pnpm test:e2e` |
| `apps/web/tests/e2e/` | Playwright on the public site (seeded CMS + web running) | `cd apps/web && pnpm test:e2e` |

A bug fix should come with the test that would have caught it.

## Commits

Conventional-ish prefixes: `feat`, `fix`, `docs`, `test`, `ci`, `build`,
`chore`, with a scope when useful (`feat(web): …`). Say in the body *why*, not
only what. Update the docs in the same commit (README, PROGRESS, DEPLOYMENT,
env templates): the checklist is in CLAUDE.md §1.

Dependencies: `pnpm add` in the right workspace, then commit the **root**
`pnpm-lock.yaml` (CI installs with `--frozen-lockfile`). Dependabot PRs: green CI
→ merge (README → Dependency updates).
