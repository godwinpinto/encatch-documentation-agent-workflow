#!/bin/sh
set -e

cd /app

# Optional authenticated origin for private repo fetch (e.g. GitHub App installation token URL).
if [ -n "$GIT_REMOTE_URL" ]; then
  git remote set-url origin "$GIT_REMOTE_URL"
fi

if [ "${SYNC_REPO_ON_START:-false}" = "true" ]; then
  git fetch origin main
  git checkout main
  git reset --hard origin/main
fi

exec pnpm --filter @encatch/agentic-workflow start:prod
