// GET /api/telemetry — spec-aligned deterministic mock + production hardening.
// Returns TowerTelemetry[] (spec §3.1). Legacy {towers} wrapper available via ?shape=wrapped.
// Read-only, Zero-PII, no Econet core writes.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildTelemetry } from '../src/lib/towers';

export { buildTelemetry };

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
  res.setHeader('Content-Type', 'application/json');
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET /api/telemetry.' });
    return;
  }
  const raw = req.query.loadShedding;
  const loadShedding = raw === 'true' || raw === '1';
  if (typeof raw !== 'undefined' && raw !== 'true' && raw !== 'false' && raw !== '1' && raw !== '0') {
    res.status(400).json({ error: "Invalid loadShedding. Use 'true' or 'false'." });
    return;
  }
  const towers = buildTelemetry(loadShedding);
  // Default: spec-compliant bare array. ?shape=wrapped keeps legacy {towers} clients working.
  if (req.query.shape === 'wrapped') {
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      pilot: 'Harare regional pilot (100 towers)',
      statutoryLimits: { cellAvailability: 67, dsasr: 95, dsdr: 2 },
      towers
    });
    return;
  }
  res.status(200).json(towers);
}
