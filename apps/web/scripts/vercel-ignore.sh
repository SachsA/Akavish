#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json `ignoreCommand`), run from apps/web.
# Exit 0 = skip the build, 1 = build. Skips pushes that don't touch the site:
# docs, the CMS, the mobile app (2026-11-23: build minutes were most of the
# Vercel bill). Compares with the last deployed commit, so several commits
# pushed at once are all looked at; when that commit is unknown (first deploy
# of a branch, shallow clone), it builds.
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$prev" ] || ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  echo "No previous deployment to compare with: building."
  exit 1
fi
# Same commit again: a Redeploy from the dashboard (new env variable…), on purpose.
if [ "$prev" = "$(git rev-parse HEAD)" ]; then
  echo "Redeploy of the same commit: building."
  exit 1
fi
if git diff --quiet "$prev" HEAD -- . ../../packages ../../package.json ../../pnpm-lock.yaml ../../pnpm-workspace.yaml; then
  echo "Nothing changed for the website since ${prev:0:7}: skipping the build."
  exit 0
fi
echo "The website changed since ${prev:0:7}: building."
exit 1
