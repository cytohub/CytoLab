#!/bin/sh
# Container entry point: bring the schema up to date, make sure a public demo's
# workspace exists (a no-op once seeded), then serve the app on $PORT.
set -eu

# The platform's private network can take a moment to come up after the
# container starts, so give the first database connection a few tries.
attempt=1
until pnpm db:migrate; do
  if [ "$attempt" -ge 5 ]; then exit 1; fi
  attempt=$((attempt + 1))
  sleep 3
done

case "${PUBLIC_DEMO:-false}" in
  true | 1) pnpm db:seed ;;
esac

# Keep idle connections open longer than the platform's proxy does (60 s on
# Railway), so it never reuses a connection Node has already closed.
exec node_modules/.bin/next start --keepAliveTimeout 70000
