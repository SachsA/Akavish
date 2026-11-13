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
| `articles` | Title, slug, excerpt, rich-text content, cover image, category, status (draft/published/archived), featured, author, game, *Also covers* (`relatedGames`: the other games a recap covers, listed on their pages too), tags, SEO, and for reviews a `score` out of 10 (shown on the article and the cards, and sent as a schema.org Review). Versioned with drafts. `publishedAt` is auto-stamped — see below. |
| `authors`  | Public profile shown on article cards/pages.                                                                                                       |
| `games`    | Game metadata articles can be tagged to: cover, *Other images* (`gallery`, official visuals the AI scout rotates through so one game doesn't always get the same cover), platforms, genres, dates, studio. |
| `tags`     | Cross-cutting topics, 2 to 5 per article: publisher or studio (Rockstar Games, Riot Games), platform (PS5, Switch 2), event (Worlds 2026, CS2 Major) or theme (Release dates, Trailers, Earnings). Not the game (that's `game`) nor the type (that's `category`). Each tag has its public page `/tag/<slug>`, linked from the article (#chips) and listed in the sitemap once it has a published article. |
| `media`    | Uploaded images (cover images, avatars). Stored in Cloudflare R2 — see below.                                                                       |
| `users`    | CMS editors — Payload auth (separate from reader auth, which is Clerk), each with a `role` (admin / editor / writer) and an *Author profile*. See "Roles" below. Password resets go out via Resend — see below. |
| `subscribers` | Newsletter sign-ups (double opt-in). Admins can read them; nobody can add one by hand. See "Newsletter" below. |
| `readers`, `bookmarks` | Reader accounts (one per Clerk account) with their role badge, and their saved articles. Admins only; written by the site and Clerk's webhook. See "Reader accounts" below. |
| `scout-sources`, `scout-items`, `scout-stories`, `scout-usage` + global `scout-settings` | The AI scout (admin group **Scout**). See "AI scout" below. |

### Slugs

`articles`, `authors`, `games` and `tags` share a reusable `slugField`
(`src/fields/slug.ts`). The slug is **auto-generated** from the source field
(title for articles, name for the rest) when left empty, stays **manually
editable**, and **auto-deduplicates** with a numeric suffix (`-2`, `-3`, …) on
collision. Existing docs keep their slug until re-saved.

### `publishedAt` is stamped automatically

A `beforeChange` hook on `articles` sets `publishedAt` the first time an article
reaches `status: published`, if the field is empty. It's still editable — set it
by hand to override, e.g. to backdate an import.

This exists because the field used to be filled manually and, predictably, wasn't:
every early article shipped with a null date. That silently cost the byline date,
`datePublished` in the article JSON-LD (what Google leans on hardest for news),
the prev/next navigation on the article page, and any meaningful `-publishedAt`
ordering — the sort the whole site uses.

Re-saving an already-published article that has no date backfills it from
`createdAt` rather than today, so fixing old content doesn't rewrite its history.

### Renaming a published article keeps old links working

When the slug of a **published** article changes, a `beforeChange` hook appends
the old slug to `previousSlugs`. The web app's article page falls back to that
list on a miss and answers with a **308** to the current URL, so shared links,
bookmarks and search rankings follow the rename. Renaming back to an old slug
removes it from the list. Drafts that were never public aren't tracked.

### Scheduling a publication

Save the article first (Save Draft), with **Status** on Draft or Published.
Then open the arrow next to **Publish changes** → **Schedule Publish**, pick
the date and time. Payload queues a job; the CMS checks the queue every minute
(`jobs.autoRun` in `payload.config.ts`) and publishes it then. Publishing also
switches **Status** from Draft to Published, so the article appears on the
site; Archived is never touched. Upcoming schedules show in the same drawer,
where they can be cancelled.

Scripts can do the same: `POST /api/articles-schedule` with
`{ "id": 12, "publishAt": "<ISO date>" }`, logged in as an editor
(`src/lib/schedule-publish.ts`), queues the exact job the button queues. A
new date replaces the article's pending one; `"publishAt": null` cancels it.

### Publishing articles from Markdown

`scripts/publish-articles.mjs` posts articles written in Markdown to a running
CMS over REST, with their cover images and games, and publishes them now,
schedules them, or leaves them as drafts. No dependencies, plain Node:

```bash
node apps/cms/scripts/publish-articles.mjs import-images/articles.md --images import-images [--dry]
```

It logs in with `CMS_EMAIL` / `CMS_PASSWORD` from the environment or from
`.cms-import` at the repo root (gitignored), against `CMS_URL`
(default `https://cms.akavish.gg`): use a dedicated editor account. The file
format (front matter per game or article, `tags:` as a comma list matched by
name and created if new, Markdown body with `##` headings,
`- ` lists, `**bold**` and links) is documented at the top of the script.
Re-running is safe: games and media are reused, articles updated in place;
to fix one article, re-run with `--only <slug>`. `score:` sets a review's
score out of 10. `relatedGames:` (game slugs)
fills *Also covers*, and `[**Name**](/game/<slug>)` in the body is a site link
(same tab). An optional `publishedAt:`
backdates an archive piece (the old conference recaps, say) so it sits at its
real date and doesn't take the top of the homepage.
`import-images/` (the images and the Markdown) and `import-docs/` (Alex's own
source documents) are gitignored.

### Picking the homepage lead story (`featured`)

Tick **featured** in an article's sidebar to make it the big lead story on the
homepage. If several are ticked, the most recently published one wins; with
none, the lead is simply the newest article. It isn't repeated in *Top
stories*, but it does show again in its own category section lower down (as
do the top stories, since 2026-11-11), so each section is the true latest of
that category. Untick it once the story is no longer the headline: nothing
expires it automatically.

## Access control

Public (unauthenticated) read access is intentionally scoped:

- **articles** — public reads are filtered to `status: published`. Logged-in
  editors see drafts and archived items too.
- **authors / games / tags / media** — publicly readable (non-sensitive content
  populated into article cards and pages).

- **subscribers** — no public access at all, admins only, and `create` is
  closed even to them: rows only come from the newsletter endpoints (below).
- **readers / bookmarks** — no public access, admins only, `create` closed:
  rows come from `src/lib/readers.ts` (below).

### Roles (`src/access/roles.ts`)

| Role | Can |
| --- | --- |
| **admin** | Everything: users and their roles, subscribers, readers, the scout. |
| **editor** | Write, edit, publish and delete any article; games, tags, authors, media; the scout. |
| **writer** | Write articles under their own author profile and save drafts. Can't publish (the hook refuses), can't edit a published article or someone else's, can't delete. |

The first account ever created is an admin; later ones start as writers. Only
an admin changes a role or an author profile. Accounts that existed before
roles (migration `roles_readers`) became admins. `POST /api/articles-schedule`
is for editors and admins.

This is why the public site can render articles without a CMS login. If you add a
new collection that the frontend needs to read, remember to set its
`access.read` accordingly — Payload denies public reads by default.

## Media storage (Cloudflare R2)

Uploads are stored in an R2 bucket through its S3-compatible API, wired with
`@payloadcms/storage-s3` in `src/payload.config.ts`. This is **required in
production**: hosts like Railway have an ephemeral filesystem, so locally-stored
files disappear on every redeploy.

- Enabled only when `R2_BUCKET` is set — otherwise Payload falls back to local
  disk, so a fresh clone works with no cloud setup.
- On upload, Sharp generates resized variants (`thumbnail` 480w, `card` 960w,
  `hero` 1920w, `square` 256×256) alongside the original. The web app requests
  the right variant per context, so a 4 MB original is never used as the source
  for a 400px card. **Existing files keep working** (the mapper falls back to the
  original) but only get variants if you re-upload them.
- Sharp never upscales: a variant wider than the source image comes back `null`
  (a 480px-wide upload has no `card`/`hero`). That's expected — the web falls
  back to the original, which is small anyway. **Upload covers around
  1920–2560px wide** to get every variant without storing needless bulk.
- Files are served straight from `R2_PUBLIC_URL` (Payload's file proxy is
  bypassed via `disablePayloadAccessControl`, fine since media is public).
- `R2_ENDPOINT` is the S3 API endpoint — used for **uploads only**, never to
  serve files.

The media schema is the same with or without R2 (`alwaysInsertFields: true` in
`payload.config.ts`), so a migration generated on a laptop without R2 matches
prod. Before that flag, one didn't, and prod's media API broke (`DEPLOYMENT.md` §5). Full setup (bucket, public URL, API token) in
[`DEPLOYMENT.md`](../../DEPLOYMENT.md) §4b.

## Transactional email (Resend)

Password resets and account verification are sent through Resend's REST API via
`@payloadcms/email-resend`, configured in `src/payload.config.ts`.

- Enabled only when `RESEND_API_KEY` is set. Unset, Payload falls back to its
  **console adapter**: emails are printed to the terminal, not sent. That's fine
  locally, but in production it means the "forgot password" flow looks like it
  works while the reset link never arrives — and a lost admin password locks you
  out for good.
- `EMAIL_FROM_ADDRESS` must belong to a domain verified in Resend
  (`mail.akavish.gg`), otherwise Resend rejects the send and Payload logs an
  `APIError`. `EMAIL_FROM_NAME` is the display name.
- This handles **sending** only. Incoming mail to `hello@` / `tips@` / `privacy@`
  is Cloudflare Email Routing, which is a separate, receive-only thing.

Domain verification and the DNS records are in
[`DEPLOYMENT.md`](../../DEPLOYMENT.md) §4c.

### The "forgot password" email

`src/lib/emails/forgot-password.ts` holds a branded HTML template (table layout +
inline styles, for email-client compatibility) that replaces Payload's bare
default. It's wired through `auth.forgotPassword` in `collections/Users.ts`.

The link points at `${serverURL}/admin/reset/<token>` — the same target as the
default — so `SERVER_URL` must be right in production or the button leads
nowhere. Validity is `FORGOT_PASSWORD_EXPIRATION_MS` (1 hour), exported from the
template module so the config and the "expires in one hour" copy can't drift.

> `auth.forgotPassword` is **runtime config, not fields** — it adds no columns,
> so editing it needs no migration. What *would*: `verify`, `loginWithUsername`,
> `useAPIKey`, `useSessions`. See [`CLAUDE.md`](../../CLAUDE.md) §2.

Only CMS editors ever receive this; reader accounts are handled by Clerk on the
web app and never touch Payload auth.

## Reader accounts and saved articles

Readers sign up on the site with Clerk. `src/lib/readers.ts` keeps a `readers`
row per Clerk account (name, email, avatar as Clerk has them, plus a **role**:
Owner, Admin, Moderator, Author, Reader, which is the badge next to their name)
and their saved articles (`bookmarks`, unique per reader and article).

| Endpoint | Does |
| --- | --- |
| `POST /api/reader-api/sync` `{ profile }` | Creates or refreshes the reader, returns it with its role |
| `GET /api/reader-api/bookmarks?clerkId&page&limit` | Saved articles still published, newest first (depth 2, like the site's lists) |
| `GET /api/reader-api/saved?clerkId&articles=1,2` | Which of these articles are saved |
| `POST` / `DELETE /api/reader-api/bookmarks` `{ clerkId, articleId }` | Save (published articles only) / unsave |
| `POST /api/clerk/webhook` | Clerk's webhook, Svix-signed (`CLERK_WEBHOOK_SECRET`): `user.created` / `user.updated` refresh the profile, `user.deleted` deletes the reader and their saved articles |

The `reader-api` endpoints answer only to `Authorization: Bearer
READER_API_SECRET` (the website, after checking the Clerk session); a reader
who doesn't exist yet is created on the spot, so the site works before the
webhook is set up. Rules, tested in `tests/int/readers.int.spec.ts`:

- only one **Owner**, ever (the save is refused with an error on the role);
- a reader whose **verified** email matches a CMS user is linked to that user
  and its author profile, and becomes **Author** if they were a plain reader;
- deleting a reader deletes their saved articles; deleting an article deletes
  the copies readers saved; an unpublished article just drops off the lists.

Setup in production: `DEPLOYMENT.md` §6.5b.

## Newsletter (double opt-in)

Readers sign up on the web (footer and end of articles). The rules live in
`src/lib/newsletter.ts`, behind three public endpoints declared in
`payload.config.ts`:

| Endpoint | Does |
| --- | --- |
| `POST /api/newsletter/subscribe` `{ email, consent: true, source }` | Creates (or refreshes) a `pending` subscriber and emails a confirmation link (`src/lib/emails/newsletter-confirm.ts`) to `${WEB_URL}/newsletter/confirm?token=…` |
| `POST /api/newsletter/confirm` `{ token }` | `pending` → `confirmed`; returns the subscriber's unsubscribe token |
| `POST /api/newsletter/unsubscribe` `{ token }` | Deletes the subscriber |

What the privacy policy promises, and where it's enforced (all in
`lib/newsletter.ts`, tested in `tests/int/newsletter.int.spec.ts`):

- nobody is subscribed without clicking the emailed link; consent must be
  `true` (the unticked box on the form);
- "subscribe" answers the same for new, pending and confirmed addresses, so it
  can't tell anyone who's on the list; a confirmed address gets no email;
- at most one confirmation email per address per 10 minutes (the web adds a
  per-IP limit, but these endpoints can be called directly);
- unsubscribing deletes the row; unconfirmed rows are deleted after 30 days
  (swept on each new sign-up);
- the confirmation token is stored as a SHA-256 hash (`tokenHash`, hidden from
  the API and the admin); unsubscribe links are `<id>.<HMAC>` signed with
  `PAYLOAD_SECRET`, so every future issue can carry one without storing
  anything. Rotating `PAYLOAD_SECRET` breaks unsubscribe links already sent.

`WEB_URL` must be the public site (`https://akavish.gg` in prod) or the
confirmation link points at the wrong host. Locally, without
`RESEND_API_KEY`, the email is only logged (subject and address, not the
link). Sending issues isn't built yet: when it is, send to
`status: confirmed` only and put `unsubscribeUrl(id)` in each one.

## AI scout

`src/scout/` watches games news, groups it into stories and scores them
(design doc and steps: `PROGRESS.md` → AI news scout; setup and variables:
`DEPLOYMENT.md` §11). Step 2 turns the best stories into **draft** articles
and asks for validation on Discord; nothing is published without a click.

How a run goes (`src/scout/run.ts`, the `scoutTick` job every 5 minutes in its
own `scout` queue, a no-op unless `SCOUT_ENABLED=true`):

1. **Sources** (`default-sources.ts`): loaded into `scout-sources` the first
   time, then edited in the admin. Official feeds every 5 min, the rest every 15.
2. **Collect** (`collect.ts`, `feeds.ts`): conditional GET, RSS/Atom parsed,
   URLs normalised, items older than 48 h or already seen skipped, general
   outlets filtered to games stories. Stored as `scout-items` (kept 30 days).
3. **Triage** (`triage.ts`, `triage-prompt.ts`): up to 40 new items per run go
   to Claude Haiku with (a) Akavish's articles of the last 3 weeks (`A<id>`),
   (b) the open stories of the last 3 days with their game: every story that
   matters (score 35+, or drafted, published or rejected; up to 250) plus the
   80 latest. The answer is a forced tool call (JSON). Each item joins a
   story, starts one, repeats an article (`A<id>`: set aside as `ignored`,
   counted as `covered`), or is skipped. Anything odd in the answer becomes a
   skip, never a crash. Until 2026-11-12 only the 80 latest stories were
   shown, a few hours' worth, so the same news reported the next day became
   a second story.
4. **Score** (`score.ts`): significance × 0.6 (0-60) + 5 per extra outlet
   (0-20) + best reliability (official 25, established outlet 15, leaker 0)
   − age, out of 100. Threshold 60 by default (*Scout settings*). Retuned on
   2026-11-12 so good single-source news (an official post about a focus
   game, a big story from one outlet) can reach 60 on its own, while a lone
   leaker can't; the significance guide in `triage-prompt.ts` ranks the
   focus games' official updates, hugely anticipated games, a game's fate,
   market data (Sensor Tower, Circana) and star transfers higher.
5. **Drafts** (`draft.ts`, `draft-prompt.ts`, `extract.ts`), only when
   *Scout settings → draftsEnabled* is ticked (off by default): up to 3 stories
   per run (and `maxDraftsPerDay`) at or above the threshold, under 24 h old.
   Up to 6 sources, official first, page text read for the first 4; Claude
   Sonnet answers with a `write_article` tool call, turned into Lexical
   with a *Watch* list (videos) and a *Sources* list. **Media** (`media.ts`):
   the cover is the `og:image` of an official source, else a still of an
   official video the draft links, else the game's cover or one of its
   *Other images* in *Games*, the one the last 14 days' articles used least
   (`leastUsed`, tested), never a press outlet's image; YouTube videos found in the
   sources go to the prompt with their oEmbed title and channel, Sonnet picks
   the official ones about the story (`videos` in the tool). **Tags:** the
   existing tag names go to the prompt; Sonnet answers `tags` (existing,
   kept by `matchTags`, case-insensitive) and `new_tags` (created, at most 2,
   filtered by `cleanNewTags`: not existing, not the game, the category or a
   vague word), 5 in all. **Game:** the *Games* names go to the prompt too;
   `matchGame` matches the model's `game` on letters and digits; an empty
   answer means no game (the triage's game is only a dry-run fallback). A
   game not listed comes back with `game_is_new` and `new_game` (developer,
   publisher, platforms and genres from the collection's options,
   `cleanNewGame`) and is created, with the official cover as its own. Both
   are set on every draft and revision (a *Modifier* replaces tags set by
   hand). `rejectStory` deletes the tags and game created since the story's
   first draft that no article uses any more. **Duplicates** (`dedupe.ts`):
   before each automatic draft, Haiku compares the story with the articles of
   the last 21 days and the stories rejected in the last 10; a repeat becomes
   `rejected` with "auto : doublon de l'article …" and no Discord card. Usage
   purpose `dedupe`. Menu picks skip it.
   **Alt text** of an official cover: the publisher's `og:image:alt`, else
   "Official image from <source>: <title>". Every field a draft fills (and
   when one can stay empty) is listed in `DEPLOYMENT.md` §11. Claude Sonnet 5.5 refuses a *forced* tool call
   (400), so `anthropic.ts` falls back to `tool_choice: auto` with an explicit
   instruction and up-front thinking off (`between_tools`) for any model that
   refuses, and remembers it. Saved as a **draft** article, `aiAssisted` ticked,
   author from *Scout settings → defaultAuthor*.
6. **Digest** (`digest.ts`, `discord.ts`): at 8 am and 8 pm Paris time, the
   new stories by score, green above the threshold. Through the bot when it's
   set up (with a "Rédiger…" menu to draft one by hand), else the webhook.
7. **Budget** (`budget.ts`, `pricing.ts`): every call logged in `scout-usage`
   with its cost; 80 % warning, auto-pause at the monthly cap, daily cap.
8. **Retention** (`retention.ts`): hourly clean-up of old items and stories.
9. **Weekly report** (`report.ts`): with the first digest on Saturday, the
   numbers behind the threshold review: stories per day, score spread, how
   many would pass at 45 to 75, best stories and those just below, drafts
   published / rejected, cost and 30-day pace, feeds that brought nothing or
   fail. Any time in the browser, logged into `/admin`:
   `GET /api/scout/report?days=7` (plain text, `&format=json` for JSON; 401
   without an editor session).

**Event mode** (`live.ts`, `live-prompt.ts`, `discord-commands.ts`, collection
`scout-events`). `/live start|add|image|stop|status` slash commands, registered
at start-up (`onInit` in `payload.config.ts`, global commands, PUT overwrite)
and answered on the same interactions endpoint (type 2). The event keeps its
entries, the editor's notes (`n<k>`, done or pending), the previous version
(undo), a revision number and a cursor on scout items. The `live` step of each
run sends the pending notes and the new items (official and established
sources) to Sonnet with the entries so far (`update_live` tool: `new_entries`,
`update_entries` to complete or correct one, `game` / `game_is_new`);
`cleanLive` keeps only links that were given and existing entries,
`applyLive` merges, games are matched or created like drafts. Unpublished: a
draft article and one Discord card edited in place; after **Publier le live**
every change is published with an **Annuler cette MAJ** button
(`scout:evundo:<event>:<rev>`). `/live stop` → status `ending` → next run:
final update, "the show is over", recap drafted (`RECAP_SYSTEM`, the draft
tool, trailers in *Watch*) with **Publier le résumé** / **Rejeter**. Auto-stop
after 8 h. Usage purposes `live` and `recap`.

**Discord validation** (`discord-bot.ts`, `interactions.ts`). Each draft is a
bot message with **Publier** / **Modifier** / **Rejeter** and a link to
`/admin`. Discord posts the clicks to `POST /api/scout/discord` (declared in
`payload.config.ts`): Ed25519 signature checked against `DISCORD_PUBLIC_KEY`
(401 otherwise), PING answered, only `SCOUT_DISCORD_OWNER_ID` accepted.
Publish sets the article live, and refuses (privately) while it has no cover;
Edit opens a form (feedback and/or an image URL, both optional, one needed) and
queues a `scoutDraft` job (`storyId`, `feedback`, `imageUrl`): feedback → V2
rewritten as a reply; image only → `setStoryImage`, the cover changes without
an AI call. Reject deletes the draft article. The card shows the cover (embed
image), its origin or an orange "no image" warning, and the videos. Anything
that calls the model runs as a `scoutDraft` job (Discord wants an answer within
3 s). The story keeps `version`, `feedback`, `lastDraftText` and the article.

```bash
pnpm scout:run            # LOCAL DB only: one run on the real feeds, dry (no AI, no Discord)
pnpm scout:run --live     # uses ANTHROPIC_API_KEY / SCOUT_DISCORD_WEBHOOK_URL from .env
pnpm scout:run --digest   # also print (or send, with --live) the digest now
pnpm scout:run --report   # only print the weekly report (--days=N), no run
```

Tests: `pnpm test` (pure logic: feeds, score, Paris clock, triage answers,
digest messages, pricing, draft cleaning, Lexical, page text, share image and
YouTube ids, Discord signatures and buttons, weekly report) and
`tests/int/scout.int.spec.ts` (the whole run, then drafts with their cover and
Watch list, revisions, the no-cover Publish refusal, an image-only change and
signed clicks, the report endpoint and the Saturday report, with the network
faked). ⚠ The integration test empties the scout tables of the
local database it runs on.

## Site refresh (on-demand revalidation)

The site caches its CMS reads for 30 s and serves the stale copy once past
that, so a new article could take a few reloads to show. `src/lib/revalidate-web.ts`
hooks `afterChange` / `afterDelete` on articles, games, tags and authors: when
the change is public (drafts of never-published articles are skipped) it posts
to `WEB_URL/api/revalidate` with `x-revalidate-secret: REVALIDATE_SECRET`,
fire-and-forget. The web route drops the `cms` cache tag and the whole layout.
Same secret on both apps; unset → no ping, nothing breaks. `DEPLOYMENT.md` §4e.

## ⚠️ After adding or removing a Payload plugin

Run **`pnpm generate:importmap`** and commit the regenerated
`src/app/(payload)/admin/importMap.js`. Payload resolves admin UI components
through that file; if it's stale the admin panel fails to boot and renders a
**blank page** (the server still returns HTML, so it looks like the site is up).
Same goes for `pnpm generate:types` if you changed collections.

## Search indexing (Meilisearch)

The CMS keeps a Meilisearch `articles` index in sync with published content:

- `src/lib/meilisearch.ts` — client + index settings.
- `src/lib/article-search-sync.ts` — maps an article → search doc, upsert/remove.
- `Articles` collection `afterChange` / `afterDelete` hooks call the sync helpers.
  Published articles are upserted; drafts/archived are removed from the index.
- Indexing is **best-effort** — if `MEILISEARCH_HOST` is unset or Meilisearch is
  down, edits still succeed (errors are logged, not thrown). The web app's
  `/api/search` then falls back to querying this CMS directly (Postgres
  `ILIKE`), so site search keeps working without Meilisearch at all.

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
pnpm seed               # LOCAL DB only: admin (if none) + sample articles (--with-images to force covers with R2 on)
pnpm migrate:create     # create a DB migration from the current schema
pnpm migrate            # apply pending DB migrations
pnpm migrate:status     # show migration state
pnpm migrate:fresh      # drop everything + re-run all migrations (destructive)
pnpm generate:types     # regenerate src/payload-types.ts from collections
pnpm generate:importmap # regenerate the admin import map
pnpm build              # production build
pnpm scout:run          # LOCAL DB only: one AI-scout run, dry by default (see "AI scout")
pnpm test               # unit tests (src/**/*.test.ts, scripts/**/*.test.mjs), no database
pnpm test:int           # LOCAL DB only: integration tests (slugs, publishedAt, featured default, previousSlugs, public access, newsletter, scout)
pnpm test:e2e           # Playwright through the admin panel on :3001 (starts `pnpm dev` if nothing is running)
```

Both test suites need the local Postgres migrated (`docker compose up -d` +
`pnpm migrate`). `test:int` writes and deletes its own documents and refuses
any non-localhost `DATABASE_URL`. The first `test:e2e` run needs a browser:
`pnpm exec playwright install chromium`. CI runs both on every push.
