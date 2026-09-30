#!/bin/bash
# SessionStart hook for Claude Code on the web: prepares the environment so
# tests, linters and the app run without manual setup. Idempotent and web-only.
set -euo pipefail

# Only run in the remote (web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# 1. Env file (never overwrites an existing one).
if [ ! -f .env ]; then
  cp .env.example .env
fi

# 2. Node dependencies (install, not ci, so the cached container reuses the store).
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --prefer-offline >/dev/null 2>&1 || pnpm install
fi

# 3. PostgreSQL: start the local server and ensure the role + databases exist.
if command -v pg_ctlcluster >/dev/null 2>&1 || command -v service >/dev/null 2>&1; then
  service postgresql start >/dev/null 2>&1 || true
  # Wait briefly for the socket.
  for _ in $(seq 1 10); do
    if su postgres -c "pg_isready" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='cytolab'\"" 2>/dev/null | grep -q 1 \
    || su postgres -c "psql -c \"CREATE ROLE cytolab LOGIN PASSWORD 'cytolab' CREATEDB\"" >/dev/null 2>&1 || true
  for db in cytolab cytolab_test; do
    su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$db'\"" 2>/dev/null | grep -q 1 \
      || su postgres -c "createdb -O cytolab $db" >/dev/null 2>&1 || true
  done
fi

# 4. Apply migrations and load the demo workspace (seed is a no-op if it exists).
if command -v pnpm >/dev/null 2>&1; then
  pnpm db:migrate >/dev/null 2>&1 || true
  pnpm db:seed >/dev/null 2>&1 || true
fi

echo "CytoLab environment ready."
