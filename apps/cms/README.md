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
| `games`    | The games library (`/games`): cover, *Other images* (`gallery`, official visuals the AI scout rotates through so one game doesn't always get the same cover), **releases** (one row per group of consoles released together: consoles from Platforms, date, precision day / month / quarter / year / TBA; a port is its own row), developers and publishers (Companies), genres. A `beforeChange` hook derives the read-only `platforms`, `releaseDate` (the first) and `releaseDatePrecision` from the releases (`src/lib/game-releases.ts`, unit-tested). The old `platform` (families) / `developer` / `publisher` (text) fields are gone (migration `drop_old_game_fields`, 2026-11-17). |
| `platforms` | Consoles (and PC, mobile, VR), since 2026-11-18 (🟠 migration `20261118_154700_platforms_collection` turned the old select values into links): name, slug (`ps5`), short label (`PS5`), family (the library's groups), position (order in the family, newest first), aliases (the scout matches them), release date + precision, logo, tag (its articles show on its page `/platform/<slug>`). A game release links to them; the scout creates one the news names for the first time (`src/lib/platforms.ts` has the 24 it started with and `familyOf`). |
| `companies` | Studios and publishers, each with its page `/company/<slug>` (its games and the news about them): name, *aliases* (former names, other spellings: the scout matches them), logo, and the company's tag if it has one (its articles show on the page too). |
| `tags`     | Cross-cutting topics, 2 to 5 per article: publisher or studio (Rockstar Games, Riot Games), platform (PS5, Switch 2), event (Worlds 2026, CS2 Major) or theme (Release dates, Trailers, Earnings). Not the game (that's `game`) nor the type (that's `category`). Each tag has its public page `/tag/<slug>`, linked from the article (#chips) and listed in the sitemap once it has a published article. |
| `media`    | Uploaded images (cover images, avatars). Stored in Cloudflare R2 — see below.                                                                       |
| `users`    | CMS editors — Payload auth (separate from reader auth, which is Clerk), each with a `role` (admin / editor / writer) and an *Author profile*. See "Roles" below. Password resets go out via Resend — see below. |
| `subscribers` | Newsletter sign-ups (double opt-in). Admins can read them; nobody can add one by hand. See "Newsletter" below. |
| `readers`, `bookmarks`, `game-follows` | Reader accounts (one per Clerk account) with their role badge, their saved articles and followed games. Admins only; written by the site and Clerk's webhook. See "Reader accounts" below. |
| `comments`, `comment-votes`, `comment-reports` + global `community-settings` | Comments under articles, likes / dislikes, reports, and the switches (comments on, reports before auto-hide). Admin group **Community**. See "Comments" below. |
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
to fix one article, re-run with `--only <slug>`. A game block takes
`developers:` / `publishers:` (companies, created if new) and
`releases: ps5, xbox-series @ 2026-11-19; pc @ TBA` (console slugs from
the CMS's Platforms; dates `2026-11-19`, `2026-11`, `2026-Q4`, `2026` or
`TBA`; a typo stops the run). `score:` sets a review's
score out of 10. `relatedGames:` (game slugs)
fills *Also covers*, and `[**Name**](/game/<slug>)` in the body is a site link
(same tab). An optional `publishedAt:`
backdates an archive piece (the old conference recaps, say) so it sits at its
real date and doesn't take the top of the homepage.
`import-images/` (the images and the Markdown) and `import-docs/` (Alex's own
source documents) are gitignored.

### Results that spoil (`spoiler`)

*Gives a result away* (sidebar, 2026-11-25): readers who hide esport scores
see the article blurred in lists until they open it (the site's anti-spoil,
`apps/web/src/lib/spoilers.ts`). The scout ticks it on a draft whose story's
esport kind is `result` or `final`, which includes the morning recap (its
story is a `result`); it never unticks it. Tick it by hand on any other
article that gives a score or a winner in its title or excerpt.

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
- **readers / bookmarks / game-follows** — no public access, admins only, `create` closed:
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
  `hero` 1920w, `square` 256×256) alongside the original, **in WebP** (quality
  80) since 2026-11-23; the original stays as uploaded and the site never shows
  it. The web app requests the right variant per context, so a 4 MB original
  is never used as the source for a 400px card.
- Sharp never upscales: a picture narrower than a variant gets it at its own
  width (`withoutEnlargement: true`), so every image has all four. **Upload
  covers around 1920–2560px wide** for a sharp article top.
- **Images uploaded before WebP**: `node apps/cms/scripts/media-webp.mjs`
  (`--dry` to list, `--max N` to try a few) calls `POST /api/media-webp`
  (`src/lib/media-webp.ts`, editors only), which re-saves each original so its
  sizes are made again in WebP, same original filename, old sizes deleted from
  R2, alt/credit/focal point kept. Skips what's already done, so it can be
  stopped and run again.
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
their saved articles (`bookmarks`, unique per reader and article) and followed
games (`game-follows`, unique per reader and game, 200 at most; a deleted game
or reader takes its follows with it).

| Endpoint | Does |
| --- | --- |
| `POST /api/reader-api/sync` `{ profile }` | Creates or refreshes the reader, returns it with its role |
| `GET /api/reader-api/bookmarks?clerkId&page&limit` | Saved articles still published, newest first (depth 2, like the site's lists) |
| `GET /api/reader-api/saved?clerkId&articles=1,2` | Which of these articles are saved |
| `POST` / `DELETE /api/reader-api/bookmarks` `{ clerkId, articleId }` | Save (published articles only) / unsave |
| `GET /api/reader-api/follows?clerkId` | Followed games (id, name, slug, cover), newest follow first |
| `GET /api/reader-api/following?clerkId&games=1,2` | Which of these games are followed |
| `POST` / `DELETE /api/reader-api/follows` `{ profile \| clerkId, gameId }` | Follow (verified accounts) / unfollow |
| `POST /api/clerk/webhook` | Clerk's webhook, Svix-signed (`CLERK_WEBHOOK_SECRET`): `user.created` / `user.updated` refresh the profile, `user.deleted` deletes the reader, their saved articles and followed games |

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

## Comments

`src/lib/comments.ts`, behind the same `READER_API_SECRET` (the site checks
the Clerk session, then sends the reader's Clerk profile):

| Endpoint | Does |
| --- | --- |
| `GET /api/reader-api/comments?article&page&clerkId` | Top-level comments (20 a page, by likes then oldest) with their replies (oldest first), the visible total, and the viewer's votes, reports and rights |
| `POST /api/reader-api/comments` `{ profile, articleId, body, replyTo? }` | Post or reply |
| `DELETE /api/reader-api/comments` `{ profile, commentId }` | Your own, or anyone's as Owner / Admin / Mod |
| `POST /api/reader-api/comments/vote` `{ profile, commentId, value }` | 1 like, -1 dislike, 0 take back (not on your own) |
| `POST /api/reader-api/comments/report` `{ profile, commentId, reason, note? }` | Once per reader; posted to `MODERATION_DISCORD_WEBHOOK_URL` |
| `POST /api/reader-api/comments/moderate` `{ profile, commentId, action }` | `hide` / `restore`, Owner / Admin / Mod |

Rules (tested in `tests/int/comments.int.spec.ts`): verified email, not
banned, Clerk account at least 10 minutes old; plain text up to 2,000
characters; one comment every 30 s and 30 a day, no duplicate within a day;
threads one level deep (`parent`), a reply remembers whom it answers
(`replyTo`, `replyToName`); no editing; a top-level comment deleted while it
has replies stays as "Comment deleted" (no text, no author), and goes when its
last reply does; reports from N different readers (Community settings, 3)
hide a comment until a moderator restores it (which resolves its reports).
Deleting an account removes its comments (same placeholder rule), votes and
reports; deleting an article removes its comments. In `/admin`, editors and
admins can change a comment's status or delete it (with its replies), and mark
reports Resolved. Setup in production: `DEPLOYMENT.md` §6.5c.

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
own `scout` queue, a no-op unless `SCOUT_ENABLED=true`). Payload schedules no
new run while one is unfinished, and never retries a run a stopped server left
"processing": the schedule's `beforeSchedule` first deletes such a run once
it's 20 minutes old (`releaseStaleScoutRuns`, log `[scout] stale run released`).

1. **Sources** (`default-sources.ts`): loaded into `scout-sources` the first
   time, then edited in the admin. Official feeds every 5 min, the rest every 15.
   A feed added to the file later is not loaded by itself: create it in the
   admin (or `POST /api/scout-sources`). Esport feeds since 2026-11-24:
   HLTV, VLR.gg, Dexerto LoL / Rainbow Six / Rocket League (grouped with
   Dexerto in `OUTLET_GROUPS`), esports.gg. Refused (403) and not used:
   Sheep Esports, Dot Esports, esports.gg's per-game feeds.
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
4. **Score** (`score.ts`): significance × 0.6 (0-60) + 8 per extra outlet
   (0-24; outlets, not feeds: IGN France counts with IGN; only when the
   significance is 40+) + best reliability (official 25, established outlet
   15, leaker 0; HLTV and VLR.gg are official for an esport story) − age, out
   of 100. A new story only HLTV or VLR.gg carry is esport even when the
   model says "news" (`decide`, since 2026-11-23: it filed CS2 roster moves
   and Major invites from HLTV as news). An esport story also gets an
   *Esport kind* (since 2026-11-24): `transfer` (signing, departure, bench,
   roster), `final` (title, grand final of a notable event), `qualification`
   (since 2026-11-25: a team qualified or eliminated in one of the big events
   the prompt lists, e.g. a CS2 Major stage), `result` (any other match or
   stage result), `tournament` (format, dates, invites), `other`; null on any
   other category, `other` when the model gives none. A `result` is never
   auto-drafted (the morning recap below covers it); `final`, `result` and
   `qualification` drafts are ticked *Gives a result away*; a
   `transfer` draft gets the tag `transfers` (FR "Mercato", created on first
   use), which fills `/esport/transfers`. It is the only roster tag: the
   older "Roster Moves" was merged into it on 2026-11-24 and the draft model
   can't create another (`ROSTER_TAG_WORDS`, `draft-prompt.ts`). Esport stories draft from the threshold − 10, never under 50 (`thresholdFor`), in
   the digest colours and the weekly report too. Each run scores the stories of the last 24 hours again
   from what's stored (`rescoreRecent`: weights and freshness apply at once;
   a listed story crossing the threshold goes back to "new"). Threshold 60 by default (*Scout settings*), set to 50 in production since 2026-11-23. Retuned on
   2026-11-12 so good single-source news (an official post about a focus
   game, a big story from one outlet) can reach 60 on its own, while a lone
   leaker can't; the significance guide in `triage-prompt.ts` ranks the
   focus games' official updates, hugely anticipated games, a game's fate,
   market data (Sensor Tower, Circana), star transfers, and (since
   2026-11-13) big esport playoffs and finals with a top team, star
   statements and top-team roster changes, and high-profile stories about
   the big companies of games and hardware (a CEO investigated, lawsuits,
   regulators, console and GPU prices) higher; routine matches stay low.
5. **Drafts** (`draft.ts`, `draft-prompt.ts`, `extract.ts`), only when
   *Scout settings → draftsEnabled* is ticked (off by default): up to 3 stories
   per run (and `maxDraftsPerDay`) at or above the threshold, under 24 h old.
   Up to 6 sources, official first, page text read for the first 4; Claude
   Sonnet answers with a `write_article` tool call, turned into Lexical
   with a *Watch* list (videos) and a *Sources* list. A list item starting
   with `**Name**` gets that name in bold (`listItemChildren`): release lists
   read "**Metro 2039** · Feb 4 (…)", game first, short date after. **Media** (`media.ts`):
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
   game not listed comes back with `game_is_new` and is created with its
   `game_facts` entry (below), with the official cover as its own.
   **Game facts** (`game_facts`, `cleanGameFactsList`, `scout/game-facts.ts`):
   for every game the sources date or place officially (the story's and any
   other: a lineup, a showcase), its releases (consoles + "YYYY-MM-DD",
   "YYYY-MM", "YYYY-Qn", "YYYY" or "TBA"; consoles as a slug or, for one the
   site doesn't have, its official name), developers, publishers, genres.
   **Consoles** (`resolveConsoles`): matched on slug, name or alias; a new
   one is created (family from `familyOf`, first in its family) when facts
   are applied; a family alone ("Xbox", "next-gen consoles") is never
   created and the release keeps its date only, so "PC, PS6 and Xbox" never
   reads "PC". `consoles` (draft and live tools, `cleanConsoleFacts`): a
   console announced or dated, stored on the story (`consoleFacts`), shown
   on the card (🕹️), created or dated on *Publier* (`applyConsoleFacts`,
   before the games); in live mode at once (not in a rehearsal). A rejected
   draft takes the consoles created with its game (`dropOrphanPlatforms`).
   Stored on the story (`gameFacts`), previewed on the card (🎮 Fiches jeux)
   and applied on *Publier* only: `mergeReleases` (per console the news
   wins; a vaguer date that agrees changes nothing; without consoles it moves
   what isn't out yet), empty studio / publisher / genre filled, companies
   matched on name or alias or created, games marked new created, and the
   dated games added to *Also covers*. A recap (live mode) keeps its facts on
   the event (`recapGameFacts`) for *Publier le résumé*; the live's own new
   games take their `new_game` facts at once. Both
   are set on every draft and revision (a *Modifier* replaces tags set by
   hand). `rejectStory` deletes the tags and game created since the story's
   first draft that no article uses any more (and the companies created with
   that game). **Duplicates** (`dedupe.ts`):
   before each automatic draft, Haiku compares the story with the articles of
   the last 21 days and the stories rejected in the last 10; a repeat becomes
   `rejected` with "auto : doublon de l'article …" and no Discord card. The
   answer is reason first, then `is_duplicate`: only `true` counts, an id
   next to `false` is ignored (`readDuplicate`). Usage
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
`scout-events`). `/live start|add|image|stop|status` slash commands (`start`
takes `nom`, `image`, `test`), registered
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
tool, trailers in *Watch*) with **Publier le résumé** / **Rejeter**, and the
card's 🎮 Fiches jeux (`previewGameFacts`). Auto-stop after 8 h. Usage
purposes `live` and `recap`; both call `checkBudget(…, { monthOnly: true })`
(the daily cap doesn't stop a show). A failed update throws (logged, retried
next run) after `alertFailure` posts it on Discord, once per event and error
per 30 min (in memory). **Rehearsal**: `/live start … test:True` sets
`rehearsal` on the event; `isPublic(ev)` (published and not a rehearsal)
decides every `_status` / `draft:` write, so its articles stay drafts;
`resolveGames(…, create = false)` links existing games only; `publishRecap`
returns the `previewGameFacts` lines instead of publishing; no translation
queued; `scout:evpurge:<event>` (`purgeRehearsal`, refused on a real event)
deletes the articles, the cover when no article uses it, the tag when no
article uses it, and the event. Int test: *event mode rehearsal*. Every
event-mode post goes through `liveBot(ctx)` = `botIn(bot, 'live')`
(`config.ts`): the bot with `SCOUT_DISCORD_LIVE_CHANNEL_ID` as its channel when
set, else the scout channel. Same for the budget alerts (`botIn(bot,
'budget')`, `SCOUT_DISCORD_BUDGET_CHANNEL_ID`) and the weekly report
(`'report'`, `SCOUT_DISCORD_REPORT_CHANNEL_ID`); digests and drafts stay in
`SCOUT_DISCORD_CHANNEL_ID`. Unit test `config.test.ts`.

**Discord validation** (`discord-bot.ts`, `interactions.ts`). Each draft is a
bot message with **Publier** / **Modifier** / **Rejeter** and a link to
`/admin`. Discord posts the clicks to `POST /api/scout/discord` (declared in
`payload.config.ts`): Ed25519 signature checked against `DISCORD_PUBLIC_KEY`
(401 otherwise), PING answered, only `SCOUT_DISCORD_OWNER_ID` accepted.
Publish sets the article live, and refuses (privately) while it has no cover;
Edit opens a form (feedback and/or an image URL, both optional, one needed, plus
the image's credit) and queues a `scoutDraft` job (`storyId`, `feedback`,
`imageUrl`, `imageCredit` → the media's `credit`): feedback → V2
rewritten as a reply; image only → `setStoryImage`, the cover changes without
an AI call. Reject deletes the draft article. The card shows the cover (embed
image), its origin or an orange "no image" warning, and the videos; an esport
draft also gets "📸 Photo à ajouter" (`photo_hint` from the draft tool: the
player for a transfer, the team lifting the trophy for a win), since its cover
is only the game's image until the editor adds a photo they're allowed to use. Anything
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

## French edition (`src/lib/translate.ts`)

Articles are written in English; the site also exists in French (`/fr`). Each
article has a **Français** group (`fr`: title, excerpt, content, SEO title and
description, status, date), Media has `altFr`, Tags `nameFr`, Authors `bioFr`
(migration `20261116_130858_french_version`, additive). Media also has a
`credit` (`20261116_165443_media_credit`), shown under the cover as
"Photo: …" / "Photo : …", the same in both languages.

- **When:** publishing an article, or changing the English of a published one
  (hash of title, excerpt, content and SEO in `fr.sourceHash`, keys sorted so
  `jsonb` key order doesn't count), sets `fr.status` to "pending" and queues
  `translateArticle` on the `translate` queue, a minute later (one job per
  burst of edits). Draft saves don't count.
- **How:** Claude (`SCOUT_DRAFT_MODEL`) gets the English fields and the body as
  one segment per paragraph / heading / list item, in small markup (`<b>`,
  `<i>`, `<a n="0">`, `<br/>`) so bold, italics and links survive; the answer is
  rebuilt into Lexical nodes (`applyTranslation`), a segment that doesn't parse
  keeps its text without formatting. Wrong segment count: one retry, then
  "failed". The cover's French alt comes in the same call.
- **By hand:** editing the French in /admin marks it "edited" and records the
  English it matches: it stays until the English changes (English wins).
- **Live pages:** the article of a scout event that is "live" or "ending"
  is never queued (`isLiveArticle`): it changes every 5 minutes. `runLive`
  queues one translation when the live ends. `GET /api/live-articles` (public,
  ids only) lets the web say so on the French page.
- **Tags and bios:** a new tag queues `translateTaxonomy` (names stay names,
  "Release dates" becomes "Dates de sortie"); bios are done by the backfill.
- **Backfill:** `POST /api/translate/backfill` (editors) — `DEPLOYMENT.md` §12.
- **Cost:** `scout-usage`, purpose `translate`, own monthly cap
  `TRANSLATE_MONTHLY_BUDGET_USD` (30 $). No key → nothing is translated.
- Tests: `src/lib/translate.test.ts` (markup round trip), `tests/int/translate.int.spec.ts`.

## Admin header

`src/components/admin/AccountBar.tsx` (`admin.components.actions` in
`payload.config.ts`): the logged-in email and role next to the avatar, and a
visible **Log out** button (Payload's own sits at the bottom of the side menu).
Added 2026-11-23, after the scout's editor account stayed logged in and the
admins-only Readers group looked gone. A new admin component means
`pnpm generate:importmap` (below).

## Esport follows and notifications

`src/lib/esport-follows.ts` (2026-11-25). Readers follow teams (PandaScore
team id), events (PandaScore season id: every stage) and matches:
**Esport follows** (unique per reader, kind and id, 300 at most, a snapshot of
the name and logo). Two things make **Reader notifications**: the esport sync
(a followed match going `not_started` → `running`, or ending; `transitionOf`,
`notifyMatchEvents`) and the first publication of an esport article naming a
followed team in its title or excerpt (`mentionsTeam`, Articles `afterChange`).
One per reader and event (`dedupeKey`), filtered by the reader's **notify**
settings (match starts / results / news, all on), deleted after 30 days. A
notification stores facts (`data`: teams, score, event, article), the site
words them. Website calls, with `READER_API_SECRET`:
`/api/reader-api/esport-follows` (GET / POST / DELETE),
`/api/reader-api/notifications` (GET, POST `read`),
`/api/reader-api/notify-settings` (GET / POST, only the booleans sent change),
`/api/reader-api/push` (GET count / POST subscription / DELETE). **Web push**
(`src/lib/web-push.ts`, since 2026-11-25): each notification is also pushed
to the reader's **Push subscriptions** (one per browser), worded in the
browser's language, a result without its score when `notify.hideScores`;
404 / 410 from a push service deletes the subscription. Off without
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (DEPLOYMENT.md §6.5d). Tests:
`src/lib/esport-follows.test.ts`, `tests/int/readers.int.spec.ts`.

## Esport data (PandaScore)

`src/esport/`: every 10 minutes the `esportSync` task (queue `esport`) reads
PandaScore's REST API for CS2 (`csgo`), Valorant, LoL, R6 (`r6siege`) and
Rocket League (`rl`): the running matches, the next 7 days and the last 3
days, and saves them in **Esport matches** / **Esport tournaments** (by
PandaScore id; a match is rewritten only when its `modified_at` changes).
Free plan (1,000 requests an hour, we use ~150): schedules, scores, winner,
tournaments with their tier (S > A > B > C > D), team names and logos, no
per-map stats. Off without `PANDASCORE_TOKEN`. To check the mapping on the
real API: `GET /api/esport/raw?game=cs2&list=past` logged in as an editor
(the raw first match and how it's read). Both collections are public (the
site reads them) and read-only in practice: the next sync overwrites edits.

**Brackets** (2026-11-25): after the matches, the sync reads PandaScore's
`/tournaments/{id}/brackets` (each match with the matches it follows from)
and, for a stage without a bracket (Swiss, groups), `/standings`, for the
tournaments with a new or changed match first, then those never read, bigger
tiers first, 12 a run at most (`refreshStructures`, `structureQueue`; ~150
requests an hour more). Stored on the tournament: `structure` (JSON),
`structureAt`, plus `slug` (the site's `/esport/tournaments/<slug>`),
`serieId` (the event's stages share it) and `hasBracket`. To look at the raw
answer: `GET /api/esport/raw?tournament=<PandaScore id>&kind=brackets`
(or `standings`, `tournament`), as an editor.

**Morning recap** (`src/esport/recap.ts`, called by the scout's run): from
8 am Paris, once a day (`lastEsportRecap`), yesterday's finished matches in
*Scout settings → Esport recap: tournament tiers* (S and A by default, S, A
and B in production since 2026-11-24)
become a story with one item (source "Esport results (PandaScore)", never
collected) whose text lists every match with its exact score and, for each
group or Swiss stage (not playoffs: `isBracketStage`), its standings: the
wins-losses of every team over all the stage's finished matches so far
("2-0: A, B / 1-1: … / 0-2: …"), with "qualified" / "eliminated" for the CS2
Major stages (Swiss, 3 wins / 3 losses: `swissRule`; no verdict elsewhere).
The article opens on where the stage stands and ends its results with a
"Standings after day N" list (since 2026-11-25, Alex: "qui est en 1:1"). Then a draft
through the normal pipeline (Discord card, Publish / Edit / Reject, French
after publish). A day without a match in those tiers: no recap. Off: untick
*Morning esport recap*.

## Site refresh (on-demand revalidation)

The site caches its CMS reads (5 min for lists, 1 h for the rest).
`src/lib/revalidate-web.ts` hooks `afterChange` / `afterDelete` on articles,
games, tags, authors, companies and platforms: when the change is public
(drafts of never-published articles are skipped) it posts to
`WEB_URL/api/revalidate` with `x-revalidate-secret: REVALIDATE_SECRET` and the
cache tags of what changed, fire-and-forget. `tagsFor` builds them: an article
drops the lists, its own page, its games, tags, author and the studio and
console pages of its games or tags; a game drops its page and the games list;
a studio or console its page and the taxonomy lists; an edited image (credit,
alt) the articles and games using it as cover, and the "Read next" cards; an
image with new files (replaced, re-made in WebP) everything, since its old
URLs are deleted. `POST /api/revalidate-web` (editors) drops everything by
hand. The web route drops only
those tags (no tags or over 100 → everything). Since 2026-11-19; before, every
save flushed the whole site (~15K Vercel ISR writes a day).
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
