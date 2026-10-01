import { requireEnv } from './bootstrap';

/**
 * Schema changes run as the database owner (MIGRATION_DATABASE_URL), while the
 * app can connect as a role limited to reading and writing rows (DATABASE_URL).
 * Without a separate owner URL both are the same connection.
 */
export function ownerDatabaseUrl(): string {
  return process.env.MIGRATION_DATABASE_URL || requireEnv('DATABASE_URL');
}

/** The runtime role to grant after schema changes, if one is configured. */
export function appDatabaseRole(): string | undefined {
  return process.env.APP_DB_ROLE || undefined;
}
