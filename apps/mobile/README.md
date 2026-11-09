# Akavish mobile app

Expo (SDK 58) + Expo Router. A reading app on the same CMS API as the web:
everything published on the site shows up here, nothing is written back.

## What's in it

| Screen               | Route (`app/`)        | What it does                                                                          |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Home                 | `(tabs)/index.tsx`    | Latest articles from every section, the newest as a large lead card                   |
| News, Leaks, Reviews | `(tabs)/news.tsx` …   | One section each, under the same blurb as on the web                                  |
| Sections             | `(tabs)/sections.tsx` | All six sections, then About / Contact / Privacy / Terms (open the site), app version |
| Section              | `category/[slug].tsx` | Any section (Previews, Conferences, Esport are only reachable here)                   |
| Article              | `article/[slug].tsx`  | Cover, byline with reading time, body, share sheet, "Read on akavish.gg"              |
| Not found            | `+not-found.tsx`      | A deep link to a route that doesn't exist                                             |

Lists load 12 articles at a time, more on scroll, with pull-to-refresh. Loading,
empty, error (with "Try again") and not-found states are written for readers.

Deep links: `akavish://article/<slug>`, `akavish://category/<slug>`. Opening
`https://akavish.gg/...` links in the app (universal links) needs an associated
domain, set up with the store release.

## How it's built

- `app/` holds the routes only; everything else is in `src/`, imported with
  relative paths.
- `src/theme.ts`: the web's dark palette (zinc + emerald). The app is dark only.
- `src/hooks/useArticleFeed.ts`: paging, refresh and retry for every list. Only
  the latest request is applied, so a refresh can't be overwritten by a slower
  "load more".
- `src/components/LexicalContent.tsx`: renders the article body (Payload's
  Lexical JSON) with native views; same node coverage as the web renderer.
  Links open only `http(s)` and `mailto`.
- Shared with the web, from `@akavish/api-client`: the CMS client and the
  Payload → `Article` mapper, the category list (`/categories`) and the reading
  time (`/reading-time`). Lists show the 960px `coverImageCard`; only the article
  screen loads the 1920px hero.
- Icons: `@expo/vector-icons` (Ionicons).

## Run it

```bash
cp .env.example .env   # EXPO_PUBLIC_CMS_URL: prod CMS or your Mac's LAN IP
pnpm dev               # then scan the QR code with Expo Go (SDK 58)
```

On a phone, `localhost` is the phone: point `EXPO_PUBLIC_CMS_URL` at
`https://cms.akavish.gg` or `http://<your-mac-LAN-IP>:3001`. Expo Go on iPhone
needs the same Expo account signed in on the phone and the computer
(`npx expo login`). More in the root README.

## Checks

```bash
pnpm lint && pnpm type-check && pnpm test   # all run in CI
npx expo export --platform ios              # bundles the app: catches bad imports
```

The tests cover the pure helpers in `src/lib` (dates, paging, Lexical parsing,
links). Screens need a device or simulator, so check them by hand in Expo Go
after a change. A quick look without a phone: temporarily
`npx expo install react-dom react-native-web`, then `npx expo export --platform
web` and open the output (don't commit those two dependencies; the local CMS
only allows `http://localhost:3000` as an origin, so serve it there).

## Not yet

Reader accounts (Clerk), push notifications, search, an offline cache, store
assets and the EAS build. Tracked in `PROGRESS.md` §7.
