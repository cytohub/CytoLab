#!/bin/sh
# Runs once, when the database volume is first created: adds the restricted
# role the app connects as. Migrations and the nightly reset grant its access.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE cytolab_app LOGIN PASSWORD :'app_password';
SQL
