# Akavish (AKV)

> Breaking gaming news, exclusive leaks, in-depth reviews. Fast. Serious. No fluff.

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 15 (App Router) + TypeScript + Tailwind |
| Mobile | React Native + Expo + expo-router |
| CMS | Payload 3 (integrated in Next.js) — *coming soon* |
| Database | PostgreSQL (Neon/Supabase) + Prisma |
| Auth | Clerk |
| Search | Meilisearch |
| Storage | Cloudflare R2 |
| Hosting | Vercel (web) + Expo EAS (mobile) |
| Monorepo | Turborepo + pnpm workspaces |

## Structure

```
akavish/
├── apps/
│   ├── web/          # Next.js — frontend + API routes + Payload CMS
│   └── mobile/       # Expo — iOS & Android
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── api-client/   # Shared API client (web & mobile consume same backend)
│   └── ui/           # Shared React components
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Getting started

### Prerequisites

- Node 20+
- pnpm (`npm i -g pnpm`)

### Install

```bash
pnpm install
```

### Dev (web + mobile in parallel)

```bash
pnpm dev
```

Or individually:

```bash
# Web only
cd apps/web && pnpm dev

# Mobile only
cd apps/mobile && pnpm dev
```

### Environment variables

Copy the example files and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
```

## Roadmap

- [x] Monorepo setup (Turborepo + pnpm)
- [x] Next.js web app with shared API routes
- [x] Expo mobile app consuming same API
- [x] Shared types & API client packages
- [ ] Payload CMS integration
- [ ] Prisma + PostgreSQL schema (articles, games, authors)
- [ ] Clerk auth
- [ ] Meilisearch integration
- [ ] Push notifications (Expo)
- [ ] i18n (EN + FR)
