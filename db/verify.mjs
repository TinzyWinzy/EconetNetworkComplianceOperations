import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });
const sql = neon(process.env.DATABASE_URL);
for (const t of ['crew_assignments','audit_log','care_resolutions']) {
  const r = await sql.query(`SELECT COUNT(*)::int n FROM ${t}`);
  console.log(t, 'rows:', r[0].n);
}
