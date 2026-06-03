#!/usr/bin/env bash
#
# reset-db.sh — DESTRUCTIVE. Wipes the Payload database, then runs a full clean.
#
# Drops and recreates the Postgres `public` schema (all articles, CMS users,
# media records, etc. are permanently deleted). Because the CMS runs Payload in
# "push" mode (no versioned migrations), the schema is rebuilt automatically the
# next time you start the CMS (`pnpm devsafe`).
#
# Then it runs scripts/clean.sh to reset build artifacts and dependencies too.
#
# Reads DATABASE_URL from apps/cms/.env.
#
# Usage:  pnpm reset:db            (from the repo root)
#         ./scripts/reset-db.sh
#         ./scripts/reset-db.sh --yes   # skip the confirmation prompt

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CMS_ENV="apps/cms/.env"

if [[ ! -f "$CMS_ENV" ]]; then
  echo "❌ $CMS_ENV not found. Create it (cp apps/cms/.env.example apps/cms/.env) first."
  exit 1
fi

# Pull DATABASE_URL out of the CMS env file.
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$CMS_ENV" | head -1 | cut -d'=' -f2- | tr -d '"'"'"'')"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ No DATABASE_URL found in $CMS_ENV."
  exit 1
fi

# Need psql to talk to Postgres.
if ! command -v psql >/dev/null 2>&1; then
  echo "❌ 'psql' is not installed. Install the PostgreSQL client:"
  echo "     macOS:  brew install libpq && brew link --force libpq"
  exit 1
fi

# Mask the URL when echoing (hide credentials).
MASKED="$(echo "$DATABASE_URL" | sed -E 's#://[^@]+@#://***:***@#')"

echo "⚠️  This will PERMANENTLY DELETE all data in:"
echo "      $MASKED"
echo "    (articles, CMS users, media records — everything)"
echo ""

# Confirmation unless --yes was passed.
if [[ "${1:-}" != "--yes" ]]; then
  read -r -p "Type 'reset' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "reset" ]]; then
    echo "Aborted. Nothing was changed."
    exit 1
  fi
fi

echo ""
echo "→ Dropping and recreating the public schema…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "✅ Database wiped. The CMS will rebuild the schema on next start."
echo ""

# Now do the full build/deps clean.
echo "→ Running full clean (build artifacts + dependencies)…"
echo ""
bash "$ROOT/scripts/clean.sh"

echo ""
echo "Database + workspace are reset. Next:"
echo "  pnpm install"
echo "  cd apps/cms && pnpm devsafe   # recreates tables, then create your first CMS user"
