/**
 * Convert application timestamps to strings before passing them to postgres.js.
 *
 * This project combines postgres.js with Drizzle. In this runtime a JavaScript
 * Date may reach postgres.js's string parameter encoder and fail with
 * ERR_INVALID_ARG_TYPE. ISO strings are accepted by PostgreSQL TIMESTAMPTZ
 * columns and keep all timestamps timezone-aware.
 */
export function toPostgresTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError(`Invalid PostgreSQL timestamp: ${String(value)}`);
  }
  return date.toISOString();
}
