// Seed a pilot cohort of subscriber FUP states into Neon — Zero-PII only.
// Raw MSISDNs are encrypted to HMAC-SHA256 hex at the boundary (matching
// api/billing.ts) and the raw numbers are never written to the database.
// Idempotent: re-running upserts rather than duplicating.
import { neon } from '@neondatabase/serverless';
import { createHmac } from 'node:crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });
const salt = process.env.PII_SECRET_SALT || 'econet-demo-salt-2026';
const sql = neon(process.env.DATABASE_URL);

// Demo cohort: [raw MSISDN, data used GB, fup limit GB]. Raw MSISDNs are
// Zimbabwe/Econet sample numbers (0771/0772/0711 prefix). Only the hash is stored.
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

async function main() {
  const rows = cohort.map(([msisdn, gb, limit]) => {
    const hash = createHmac('sha256', salt).update(msisdn).digest('hex'); // 64-hex
    return {
      hash,
      gb,
      limit,
      throttled: gb >= limit,
      status: gb >= limit ? 'THROTTLED' : 'ACTIVE'
    };
  });

  let seeded = 0;
  for (const r of rows) {
    const res = await sql.query(
      `INSERT INTO subscribers (hashed_msisdn, hsm_key_id, status, data_balance_bytes, fup_throttled, fup_limit_gb)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (hashed_msisdn) DO UPDATE SET
         status = EXCLUDED.status,
         data_balance_bytes = EXCLUDED.data_balance_bytes,
         fup_throttled = EXCLUDED.fup_throttled,
         fup_limit_gb = EXCLUDED.fup_limit_gb`,
      [r.hash, 'demo-pilot-v1', r.status, Math.round(r.gb * 1e9), r.throttled, r.limit]
    );
    seeded += (res && res.rowCount) || 0;
  }

  const total = await sql.query(`SELECT COUNT(*)::int AS n FROM subscribers`);
  console.log(`Seed complete. cohort=${rows.length}, upserted=${seeded}, total subscribers now=${total[0].n}`);
  console.log('Raw MSISDNs were hashed with PII_SECRET_SALT; values above are illustrative pilot data, not real subscribers.');
}

main().catch((e) => {
  console.error('SEED FAILED', e.message);
  process.exit(1);
});
