# Working agreement for Codex on Akavish

Read this first. These are standing instructions for **every** change made to this
repo — follow them without being asked.

## 1. After ANY change, update & verify ALL docs/config (not just `.md`)

Sweep this whole set every time and fix anything stale — commands, paths, ports,
URLs, script names, env vars, versions:

- **Markdown:** `README.md` (root), `apps/cms/README.md`, `PROGRESS.md`,
  `DEPLOYMENT.md`, `apps/cms/AGENTS.md`, and any other `.md`.
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
  `tsconfig` React-paths workaround) — keep them true.

Cross-check that any command/port/URL/script/version stated in one place matches
reality everywhere (a grep sweep beats eyeballing). Keep `PROGRESS.md` (done +
backlog) and the READMEs in sync with the real code state. **Doc upkeep is part of
"done."**

## 2. Tell the user which kind of push it is

- **🟠 Migration push** — only when a **DB-shape change** is made, i.e. editing a
  collection in `apps/cms/src/collections/` (add/remove field, change type, add a
  collection/relationship/index). Then, before committing:
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
- **DB:** PostgreSQL (Neon) — separate **dev** and **prod** databases. Local dev
  → dev DB (via `apps/cms/.env`); live → prod DB (via platform env vars).
- **Schema:** versioned **migrations** (`push: false`), not push mode. See
  `DEPLOYMENT.md` §5.
- **Auth:** Clerk (readers, web) · Payload auth (CMS editors).
- **Search:** Meilisearch (indexing hooks + `/api/search`).
- **CI:** `.github/workflows/ci.yml` — lint web + CMS, type-check web/CMS/shared
  packages, then build web + CMS (mobile excluded). Uses `pnpm install
  --frozen-lockfile` on Node 22.
- **Live:** web = `akavish-web-puce.vercel.app`, CMS = `akavish-production.up.railway.app`.
- **Status / roadmap:** single source of truth is **`PROGRESS.md`**. Deployment
  runbook is **`DEPLOYMENT.md`**.
- **Known gotchas** (details in `PROGRESS.md` → gotchas): media 404s in prod until
  Cloudflare R2 is wired; `shamefully-hoist` forces React-type `paths` in the web
  tsconfig (don't remove them); Node 20/22 LTS only (25 OOMs the CMS).

## Imported Claude Cowork project instructions
