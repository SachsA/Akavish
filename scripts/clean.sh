#!/usr/bin/env bash
#
# clean.sh — full reset of build artifacts and dependencies across the monorepo.
#
# Removes: node_modules (root + every workspace), .next, .turbo, .expo, dist,
#          *.tsbuildinfo, next-env.d.ts, and stray local lockfiles.
#
# Does NOT touch: .env files, the database, or your source code.
#
# After running this:  pnpm install  &&  pnpm dev   →  a clean environment.
#
# Usage:  pnpm clean        (from the repo root)
#         ./scripts/clean.sh

set -euo pipefail

# Resolve the repo root (this script lives in <root>/scripts).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "🧹 Cleaning Akavish monorepo at: $ROOT"
echo ""

# --- node_modules everywhere (root, apps/*, packages/*) ---
echo "→ Removing node_modules…"
find . -type d -name node_modules -prune -exec rm -rf '{}' + 2>/dev/null || true

# --- Next.js build output ---
echo "→ Removing .next…"
find . -type d -name '.next' -prune -exec rm -rf '{}' + 2>/dev/null || true

# --- Turborepo cache ---
echo "→ Removing .turbo…"
find . -type d -name '.turbo' -prune -exec rm -rf '{}' + 2>/dev/null || true

# --- Expo cache ---
echo "→ Removing .expo…"
find . -type d -name '.expo' -prune -exec rm -rf '{}' + 2>/dev/null || true

# --- Generic build output dirs ---
echo "→ Removing dist / build / out…"
find . -type d \( -name 'dist' -o -name 'out' \) -prune -exec rm -rf '{}' + 2>/dev/null || true

# --- TypeScript incremental build info ---
echo "→ Removing *.tsbuildinfo…"
find . -type f -name '*.tsbuildinfo' -delete 2>/dev/null || true

# --- Next/Expo generated env typings (regenerated on next dev) ---
echo "→ Removing next-env.d.ts / expo-env.d.ts…"
find . -type f \( -name 'next-env.d.ts' -o -name 'expo-env.d.ts' \) -delete 2>/dev/null || true

# --- Stray lockfiles inside workspaces (the source of truth is the root one) ---
# Keeps the root pnpm-lock.yaml; removes per-app lockfiles that shouldn't exist.
echo "→ Removing stray per-workspace lockfiles…"
find apps packages -maxdepth 2 -type f \
  \( -name 'pnpm-lock.yaml' -o -name 'package-lock.json' -o -name 'yarn.lock' \) \
  -delete 2>/dev/null || true

echo ""
echo "✅ Clean done."
echo ""
echo "Next steps:"
echo "  1. nvm use            # Node 22 LTS (see .nvmrc)"
echo "  2. pnpm install"
echo "  3. start the CMS and web in two terminals:"
echo "       cd apps/cms && pnpm devsafe   # http://localhost:3001"
echo "       cd apps/web && pnpm dev       # http://localhost:3000"
