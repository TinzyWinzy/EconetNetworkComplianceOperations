// Reset operational state tables and re-seed clean pilot subscribers.
import { neon } from '@neondatabase/serverless';
import { createHmac } from 'node:crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const dbUri = process.env.DATABASE_URL;
if (!dbUri) {
  console.error('DATABASE_URL is not configured in .env');
  process.exit(1);
}

const salt = process.env.PII_SECRET_SALT || 'econet-demo-salt-2026';
const sql = neon(dbUri);

const cohort = [
  ['0771111111', 4.2, 100],
  ['0771111112', 22.8, 100],
  ['0771111113', 49.6, 100],   // just under 50% -> 50% alert pending
  ['0771111114', 51.3, 100],   // 50% hit
  ['0771111115', 75.0, 100],
  ['0771111116', 82.4, 100],   // 80% hit
  ['0771111117', 90.9, 100],   // 90% hit
  ['0771111118', 98.2, 100],
  ['0771111119', 100.0, 100],  // at limit -> throttled
  ['0771111120', 104.7, 100],  // over limit -> throttled
  ['0712222221', 30.5, 50],    // smaller 50GB plan
  ['0773333333', 16.0, 100]    // low usage
];

async function reset() {
  console.log('--- RESETTING ECONET COMPLIANCE DATABASE ---');

  // 1. Truncate operational state tables
  console.log('Clearing operational logs, assignments, and care resolutions...');
  await sql.query('TRUNCATE TABLE crew_assignments, audit_log, care_resolutions RESTART IDENTITY CASCADE');

  // 2. Reset subscribers table
  console.log('Resetting subscribers table...');
  await sql.query('TRUNCATE TABLE subscribers RESTART IDENTITY CASCADE');

  console.log('Re-seeding initial subscriber cohort (Zero-PII)...');
  const rows = cohort.map(([msisdn, gb, limit]) => {
    const hash = createHmac('sha256', salt).update(msisdn).digest('hex');
    return {
      hash,
      gb,
      limit,
      throttled: gb >= limit,
      status: gb >= limit ? 'THROTTLED' : 'ACTIVE'
    };
  });

  for (const r of rows) {
    await sql.query(
      `INSERT INTO subscribers (hashed_msisdn, hsm_key_id, status, data_balance_bytes, fup_throttled, fup_limit_gb)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [r.hash, 'demo-pilot-v1', r.status, Math.round(r.gb * 1e9), r.throttled, r.limit]
    );
  }

  // 3. Verify counts
  console.log('\n--- VERIFICATION AFTER RESET ---');
  const tables = [
    'crew_assignments',
    'audit_log',
    'care_resolutions',
    'subscribers'
  ];
  for (const t of tables) {
    const res = await sql.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    console.log(`${t.padEnd(20)}: ${res[0].n} rows`);
  }
  console.log('\nDatabase reset completed successfully.');
}

reset().catch((e) => {
  console.error('RESET FAILED:', e.message);
  process.exit(1);
});
