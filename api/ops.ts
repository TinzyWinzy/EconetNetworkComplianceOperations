// /api/ops — persistence for operational state (crew assignments, audit log, care resolutions).
// Pilot architecture: read-only compliance sidecar + Neon Postgres.
// Zero-PII: does NOT touch subscriber PII; only ops state lives in these tables.
//
// GET /api/ops        -> { assignments: CrewAssignment[], audit: AuditEntry[], resolutions: number }
// POST /api/ops       -> body: { assignments?: [], audit?: [], resolutions?: number }
//                        Performs a bulk reconcile so refreshes/offline reconnects converge.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import type { AuditEntry, CrewAssignment } from '../src/types';

const MAX_AUDIT = 200;

function getDb() {
  const dbUri = process.env.DATABASE_URL;
  if (!dbUri) {
    throw new Error('DATABASE_URL is not configured. Set it in the environment before calling the ops API.');
  }
  return neon(dbUri);
}

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
}

function parseBody(raw: unknown): { assignments?: CrewAssignment[]; audit?: AuditEntry[]; resolutions?: number } {
  if (!raw || typeof raw !== 'object') return {};
  const body = raw as Record<string, unknown>;
  return {
    assignments: Array.isArray(body.assignments) ? (body.assignments as CrewAssignment[]) : undefined,
    audit: Array.isArray(body.audit) ? (body.audit as AuditEntry[]) : undefined,
    resolutions: typeof body.resolutions === 'number' ? body.resolutions : undefined
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  let sql;
  try {
    sql = getDb();
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
    return;
  }

  try {
    if (req.method === 'GET') {
      const assignments = await sql.query(
        `SELECT tower_code, crew, assigned_at, note, assigned_by FROM crew_assignments ORDER BY assigned_at DESC`
      );
      const audit = await sql.query(
        `SELECT logged_at as time, actor, action, detail FROM audit_log ORDER BY logged_at DESC LIMIT ${MAX_AUDIT}`
      );
      const resCount = await sql.query(`SELECT COUNT(*)::int AS n FROM care_resolutions`);
      res.status(200).json({
        assignments: assignments.map((a) => ({
          towerId: a.tower_code,
          crew: a.crew,
          assignedAt: a.assigned_at,
          note: a.note || ''
        })),
        audit: audit.map((a) => ({ time: a.time, actor: a.actor, action: a.action, detail: a.detail })),
        resolutions: resCount[0] ? resCount[0].n : 0
      });
      return;
    }

    if (req.method === 'POST') {
      const { assignments = [], audit = [], resolutions } = parseBody(req.body);

      // Assignments: top-level cron-like upsert by tower_code.
      const assignmentRows = assignments.slice(0, 200).map((a) => [
        a.towerId,
        a.crew,
        a.assignedAt,
        a.note || ''
      ]);
      if (assignmentRows.length > 0) {
        for (const row of assignmentRows) {
          await sql.query(
            `INSERT INTO crew_assignments (tower_code, crew, assigned_at, note)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (tower_code) DO UPDATE SET
               crew = EXCLUDED.crew,
               assigned_at = EXCLUDED.assigned_at,
               note = EXCLUDED.note`,
            row
          );
        }
      }

      // Audit: append only distinct timestamps already in the client ledger.
      const freshAudit = audit.slice(0, MAX_AUDIT);
      if (freshAudit.length > 0) {
        for (const a of freshAudit) {
          await sql.query(
            `INSERT INTO audit_log (logged_at, actor, action, detail, logged_dedup_key)
             VALUES ($1::timestamptz, $2, $3, $4, $5)
             ON CONFLICT (logged_dedup_key) DO NOTHING`,
            [a.time, a.actor, a.action, a.detail, `${a.time}|${a.actor}|${a.action}|${a.detail}`]
          );
        }
      }

      // Resolutions: keep a monotonic counter (pilot) — reconcile to client count when lower delta.
      if (typeof resolutions === 'number' && resolutions >= 0) {
        const existing = await sql.query(`SELECT COUNT(*)::int AS n FROM care_resolutions`);
        const current = existing[0] ? existing[0].n : 0;
        const delta = Math.max(0, resolutions - current);
        for (let i = 0; i < delta; i++) {
          await sql.query(`INSERT INTO care_resolutions (detail, resolved_by) VALUES ('care-pilot', 'Care Agent')`);
        }
      }

      const auditCount = await sql.query(`SELECT COUNT(*)::int AS n FROM audit_log`);
      res.status(200).json({ ok: true, auditCount: auditCount[0] ? auditCount[0].n : 0 });
      return;
    }

    res.status(405).json({ error: 'Method not allowed. Use GET or POST /api/ops.' });
  } catch (e) {
    console.error('ops:', (e as Error).message);
    res.status(500).json({ error: 'Ops persistence failed: ' + (e as Error).message });
  }
}
