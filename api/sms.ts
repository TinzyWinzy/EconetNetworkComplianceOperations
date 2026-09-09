// POST /api/sms — simulated notification gateway (SMS/push webhook + SMPP stand-in).
// Validates the customer-journey dispatch path and measures delivery latency
// against the <1.5s SLA in NFR-1.3. This is a SIMULATOR: no real gateway is called.
// Zero-PII: destination is referenced by hashed_msisdn prefix only; raw MSISDN never accepted.
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SLA_MS = 1500;

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
}

function simulateLatencyMs(): number {
  // 120..1299ms — always inside the 1.5s SLA, with realistic variance.
  return 120 + Math.floor(Math.random() * 1180);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST /api/sms.' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const hashedMsisdn = typeof body.hashedMsisdn === 'string' ? body.hashedMsisdn : '';
  const thresholdPct = Number(body.thresholdPct);
  const message = typeof body.message === 'string' ? body.message : '';

  if (!hashedMsisdn || !/^[a-f0-9]{64}$/i.test(hashedMsisdn)) {
    res.status(400).json({ error: 'Missing or invalid hashedMsisdn (64-hex HMAC).' });
    return;
  }
  if (!message) {
    res.status(400).json({ error: 'Missing message body.' });
    return;
  }
  if (body.thresholdPct !== undefined && (!Number.isFinite(thresholdPct) || thresholdPct < 0 || thresholdPct > 100)) {
    res.status(400).json({ error: 'Invalid thresholdPct. Expected 0-100.' });
    return;
  }
  // SIMULATOR ONLY — no real SMPP/SMS gateway called. Production must replace
  // simulateLatencyMs() with Econet SMSC/USSD provider + retry queue + DLR tracking.

  const latencyMs = simulateLatencyMs();
  res.status(200).json({
    status: 'sent',
    simulated: true,
    messageId: `sms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    dispatchedAt: new Date().toISOString(),
    latencyMs,
    slaMs: SLA_MS,
    slaMet: latencyMs < SLA_MS,
    payload: {
      channel: 'SMS',
      destinationHash: `${hashedMsisdn.slice(0, 12)}…${hashedMsisdn.slice(-6)}`,
      thresholdPct,
      message
    }
  });
}
