import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });
const sql = neon(process.env.DATABASE_URL);
const tables = [
  'towers',
  'tower_telemetry_hourly',
  'qos_compliance_alerts',
  'subscribers',
  'crew_assignments',
  'audit_log',
  'care_resolutions'
];
for (const t of tables) {
  try {
    const r = await sql.query(`SELECT COUNT(*)::int n FROM ${t}`);
    console.log(t.padEnd(25), 'rows:', r[0].n);
  } catch (e) {
    console.log(t.padEnd(25), 'error:', e.message);
  }
}
