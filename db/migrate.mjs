import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });
const sql = neon(process.env.DATABASE_URL);
let schema = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
schema = schema.split('\n').map(l => { const i = l.indexOf('--'); return i >= 0 ? l.slice(0, i) : l; }).join('\n');
const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
try {
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log('MIGRATION OK —', statements.length, 'statements');
} catch (e) {
  console.error('MIGRATION FAILED', e.message);
  process.exit(1);
}
