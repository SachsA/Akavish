# Akavish CMS

Standalone [Payload 3](https://payloadcms.com) app that powers Akavish's
content: articles, authors, games, tags and media. It serves the admin UI and a
REST/GraphQL API that the web (`apps/web`) and mobile (`apps/mobile`) apps
consume.

- **Admin UI:** http://localhost:3001/admin
- **REST API:** http://localhost:3001/api
- **Database:** PostgreSQL (via `@payloadcms/db-postgres`)

## Setup

```bash
cp .env.example .env   # then fill in DATABASE_URL + PAYLOAD_SECRET
pnpm install           # (or run pnpm install at the repo root)
pnpm devsafe           # clears .next and starts dev on port 3001
```

> Use Node 20 or 22 LTS. Node 25+ can exhaust the heap on startup.

## Collections

| Collection | Notes                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `articles` | Title, slug, excerpt, rich-text content, cover image, category, status (draft/published/archived), author, game, tags, SEO. Versioned with drafts. |
| `authors`  | Public profile shown on article cards/pages.                                                                                                       |
| `games`    | Game metadata articles can be tagged to.                                                                                                           |
| `tags`     | Free-form taxonomy.                                                                                                                                |
| `media`    | Uploaded images (cover images, avatars).                                                                                                           |
| `users`    | CMS editors — Payload auth (separate from reader auth, which is Clerk).                                                                            |

### Slugs

`articles`, `authors`, `games` and `tags` share a reusable `slugField`
(`src/fields/slug.ts`). The slug is **auto-generated** from the source field
(title for articles, name for the rest) when left empty, stays **manually
editable**, and **auto-deduplicates** with a numeric suffix (`-2`, `-3`, …) on
collision. Existing docs keep their slug until re-saved.

## Access control

Public (unauthenticated) read access is intentionally scoped:

- **articles** — public reads are filtered to `status: published`. Logged-in
  editors see drafts and archived items too.
- **authors / games / tags / media** — publicly readable (non-sensitive content
  populated into article cards and pages).

This is why the public site can render articles without a CMS login. If you add a
new collection that the frontend needs to read, remember to set its
`access.read` accordingly — Payload denies public reads by default.

## Search indexing (Meilisearch)

The CMS keeps a Meilisearch `articles` index in sync with published content:

- `src/lib/meilisearch.ts` — client + index settings.
- `src/lib/article-search-sync.ts` — maps an article → search doc, upsert/remove.
- `Articles` collection `afterChange` / `afterDelete` hooks call the sync helpers.
  Published articles are upserted; drafts/archived are removed from the index.
- Indexing is **best-effort** — if `MEILISEARCH_HOST` is unset or Meilisearch is
  down, edits still succeed (errors are logged, not thrown).

Set `MEILISEARCH_HOST` + `MEILISEARCH_API_KEY` (master key) in `.env`. Run
`docker compose up -d` from the repo root to start Meilisearch locally, then
backfill once with `pnpm reindex:search`.

### Do I need to re-run `reindex:search`?

**No, not for normal use.** The `afterChange` / `afterDelete` hooks keep the
index up to date automatically — publish, edit or delete an article and the
search index follows in real time. No manual step.

`pnpm reindex:search` is a one-off catch-up, only needed when:

- **First setup** — to index articles that already existed before the hooks were
  added (or on a fresh clone).
- **After a DB/index wipe** — e.g. after `pnpm reset:db` or deleting the index.
- **After a desync** — if Meilisearch was down during a publish, that article is
  missing until you re-save it or run a reindex (hooks are best-effort and never
  block editing, so a failed sync is logged but not retried).

In short: treat `reindex:search` as a repair/bootstrap tool, not a routine step.

## Database schema: migrations

The schema is managed by **versioned migrations** (`src/migrations/`, committed to
git), not push mode — `push: false` in `payload.config.ts`, in every environment.

Whenever you change a collection (add a field, an index, a collection…):

```bash
pnpm migrate:create <name>   # generate a migration for the change (src/migrations/…)
pnpm migrate                 # apply pending migrations to the dev DB
# commit the generated files → Railway's pre-deploy runs `pnpm migrate` on prod
```

Other commands: `pnpm migrate:status` (what's applied), `pnpm migrate:fresh`
(drop everything + re-run all migrations — destructive). Full flow + one-time
setup in [`DEPLOYMENT.md`](../../DEPLOYMENT.md) §5.

## Useful scripts

```bash
pnpm devsafe            # clean .next + dev on :3001
pnpm dev                # dev on :3001
pnpm reindex:search     # (re)index all published articles into Meilisearch
pnpm migrate:create     # create a DB migration from the current schema
pnpm migrate            # apply pending DB migrations
pnpm migrate:status     # show migration state
pnpm migrate:fresh      # drop everything + re-run all migrations (destructive)
pnpm generate:types     # regenerate src/payload-types.ts from collections
pnpm generate:importmap # regenerate the admin import map
pnpm build              # production build
```
