// Shared serverless DB access for /api/* functions (Neon Postgres, serverless driver).
// Zero-PII: only operational state (crew / audit / resolutions) is persisted here.
// Raw MSISDN and subscriber PII never touch these tables.
import { neon } from '@neondatabase/serverless';

const dbUri = process.env.DATABASE_URL;

export function getDb() {
  if (!dbUri) {
    throw new Error('DATABASE_URL is not configured. Set it in the environment before calling the ops API.');
  }
  return neon(dbUri);
}

export const OPS_TABLES = {
  assignments: 'crew_assignments',
  audit: 'audit_log',
  resolutions: 'care_resolutions'
} as const;
