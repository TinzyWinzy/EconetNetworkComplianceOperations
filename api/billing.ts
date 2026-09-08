// GET /api/billing — FUP profile from the pilot subscriber store (credible data),
// falling back to a stateless calculator when the number is unseeded or the DB
// is unreachable (offline tolerance).
// Query: ?msisdn= (legacy raw, hashed at boundary) | ?hashedMsisdn= (preferred, 64-hex)
//        &dataConsumed= (GB, calculator fallback) | &fupLimit= (GB, default 100 per spec)
// Zero-PII: raw MSISDN never logged/stored; only HMAC-SHA256 hex leaves the gateway.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import { neon } from '@neondatabase/serverless';
import type { SubscriberProfile } from '../src/types';

const HMAC_SECRET = process.env.PII_SECRET_SALT || 'econet-demo-salt-2026';
const DEFAULT_FUP_GB = Number(process.env.FUP_LIMIT_GB || 100);
const MAX_USAGE_GB = 110;

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
}

function first(q: unknown): string | undefined {
  return Array.isArray(q) ? (q[0] as string) : (q as string | undefined);
}

function buildProfile(hashedMsisdn: string, dataUsedGb: number, fupLimitGb: number, overLimit: boolean): SubscriberProfile {
  const ratio = Math.round((dataUsedGb / fupLimitGb) * 100);
  const notifiedThresholds: number[] = [];
  for (const t of [50, 80, 90, 100]) if (ratio >= t) notifiedThresholds.push(t);
  return {
    hashedMsisdn,
    activePlan: `Private ${fupLimitGb}GB FUP Limit`,
    dataUsedGb: parseFloat(dataUsedGb.toFixed(2)),
    fupLimitGb,
    fupRatioPercent: ratio,
    currentSpeedKbps: overLimit || dataUsedGb >= fupLimitGb ? 128 : 20000,
    notifiedThresholds
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET /api/billing.' });
    return;
  }
  const hashedParam = first(req.query.hashedMsisdn ?? req.query.hashed_msisdn);
  const rawParam = first(req.query.msisdn);
  let hashedMsisdn: string;
  if (hashedParam && /^[a-f0-9]{64}$/i.test(hashedParam)) {
    hashedMsisdn = hashedParam.toLowerCase();
  } else if (rawParam) {
    const clean = rawParam.replace(/[\s+()-]/g, '');
    if (!/^\d{9,15}$/.test(clean)) {
      res.status(400).json({ error: 'Invalid msisdn. Expected 9-15 digits.' });
      return;
    }
    // Boundary hashing only; raw value is never persisted or logged.
    hashedMsisdn = createHmac('sha256', HMAC_SECRET).update(clean).digest('hex');
  } else {
    res.status(400).json({ error: 'Missing subscriber key. Provide hashedMsisdn (preferred) or msisdn.' });
    return;
  }

  // 1) Credible path: resolve a stored subscriber row (Zero-PII: match on hash only).
  let dbHit: { data_balance_bytes: bigint | number; fup_limit_gb: string | number; fup_throttled: boolean } | null = null;
  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql.query(
        `SELECT data_balance_bytes, fup_limit_gb, fup_throttled FROM subscribers WHERE hashed_msisdn = $1`,
        [hashedMsisdn]
      );
      dbHit = rows.length ? (rows[0] as unknown as { data_balance_bytes: bigint | number; fup_limit_gb: string | number; fup_throttled: boolean }) : null;
    } catch {
      dbHit = null; // DB unreachable: fall through to calculator rather than fail the lookup.
    }
  }

  if (dbHit) {
    const dataUsedGb = (Number(dbHit.data_balance_bytes) / 1e9);
    const fupLimitGb = Number(dbHit.fup_limit_gb) || DEFAULT_FUP_GB;
    const profile = buildProfile(hashedMsisdn, dataUsedGb, fupLimitGb, Boolean(dbHit.fup_throttled));
    res.status(200).json(profile);
    return;
  }

  // 2) Calculator fallback: unseeded number or no DB. Stateless, per spec.
  const usageRaw = first(req.query.dataConsumed ?? req.query.dataUsed ?? req.query.dataUsedGB);
  const limitRaw = first(req.query.fupLimit);
  const dataConsumedGb = usageRaw === undefined ? 0 : parseFloat(usageRaw);
  const fupLimitGb = limitRaw === undefined ? DEFAULT_FUP_GB : parseFloat(limitRaw);
  if ((usageRaw !== undefined && (!Number.isFinite(dataConsumedGb) || dataConsumedGb < 0)) || !Number.isFinite(fupLimitGb) || fupLimitGb <= 0) {
    res.status(400).json({ error: 'Invalid usage values. dataConsumed must be >= 0, fupLimit > 0.' });
    return;
  }
  const actualUsage = Math.min(dataConsumedGb, MAX_USAGE_GB);
  res.status(200).json(buildProfile(hashedMsisdn, actualUsage, fupLimitGb, false));
}