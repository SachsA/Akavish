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

| Collection | Notes |
|------------|-------|
| `articles` | Title, slug, excerpt, rich-text content, cover image, category, status (draft/published/archived), author, game, tags, SEO. Versioned with drafts. |
| `authors`  | Public profile shown on article cards/pages. |
| `games`    | Game metadata articles can be tagged to. |
| `tags`     | Free-form taxonomy. |
| `media`    | Uploaded images (cover images, avatars). |
| `users`    | CMS editors — Payload auth (separate from reader auth, which is Clerk). |

## Access control

Public (unauthenticated) read access is intentionally scoped:

- **articles** — public reads are filtered to `status: published`. Logged-in
  editors see drafts and archived items too.
- **authors / games / tags / media** — publicly readable (non-sensitive content
  populated into article cards and pages).

This is why the public site can render articles without a CMS login. If you add a
new collection that the frontend needs to read, remember to set its
`access.read` accordingly — Payload denies public reads by default.

## Useful scripts

```bash
pnpm devsafe            # clean .next + dev on :3001
pnpm dev                # dev on :3001
pnpm generate:types     # regenerate src/payload-types.ts from collections
pnpm generate:importmap # regenerate the admin import map
pnpm build              # production build
```
