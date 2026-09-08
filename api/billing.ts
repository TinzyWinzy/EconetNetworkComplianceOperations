// GET /api/billing — spec-aligned FUP profile + production hardening.
// Query: ?msisdn= (legacy raw, hashed at boundary) | ?hashedMsisdn= (preferred, 64-hex)
//        &dataConsumed= (GB, legacy) | &dataUsed= (GB) | &fupLimit= (GB, default 100 per spec)
// Zero-PII: raw MSISDN never logged/stored; only HMAC-SHA256 hex leaves the gateway.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import type { SubscriberProfile } from '../src/types';

const HMAC_SECRET = process.env.PII_SECRET_SALT || 'radbit_telecom_salt_2026';
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

export default function handler(req: VercelRequest, res: VercelResponse): void {
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

  const usageRaw = first(req.query.dataConsumed ?? req.query.dataUsed ?? req.query.dataUsedGB);
  const limitRaw = first(req.query.fupLimit);
  const dataConsumedGb = usageRaw === undefined ? 0 : parseFloat(usageRaw);
  const fupLimitGb = limitRaw === undefined ? DEFAULT_FUP_GB : parseFloat(limitRaw);
  if ((usageRaw !== undefined && (!Number.isFinite(dataConsumedGb) || dataConsumedGb < 0)) || !Number.isFinite(fupLimitGb) || fupLimitGb <= 0) {
    res.status(400).json({ error: 'Invalid usage values. dataConsumed must be >= 0, fupLimit > 0.' });
    return;
  }
  const actualUsage = Math.min(dataConsumedGb, MAX_USAGE_GB);
  const fupRatioPercent = Math.round((actualUsage / fupLimitGb) * 100);
  const currentSpeedKbps = actualUsage >= fupLimitGb ? 128 : 20000;
  const notifiedThresholds: number[] = [];
  if (fupRatioPercent >= 50) notifiedThresholds.push(50);
  if (fupRatioPercent >= 80) notifiedThresholds.push(80);
  if (fupRatioPercent >= 90) notifiedThresholds.push(90);
  if (fupRatioPercent >= 100) notifiedThresholds.push(100);

  const profile: SubscriberProfile = {
    hashedMsisdn,
    activePlan: `Private ${fupLimitGb}GB FUP Limit`,
    dataUsedGb: parseFloat(actualUsage.toFixed(2)),
    fupLimitGb,
    fupRatioPercent,
    currentSpeedKbps,
    notifiedThresholds
  };
  res.status(200).json(profile);
}
