import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHmac } from 'node:crypto';
import { buildTelemetry } from './api/telemetry';

const HMAC_SECRET = process.env.PII_SECRET_SALT || 'radbit_telecom_salt_2026';
const DEFAULT_FUP_GB = Number(process.env.FUP_LIMIT_GB || 100);

/**
 * Dev-only mock for Vercel serverless /api routes.
 * WHY: `vite dev` has no serverless runtime, so /api/* returned HTML/TS source
 * and fetch().json() threw "Unexpected token 'c'". Prod (Vercel) still uses api/*.ts.
 * Mirrors api/telemetry.ts + api/billing.ts contracts exactly.
 */
// In-memory dev persistence mirroring/api/ops against Neon in prod.
// Dev has no Neon reachable by default, so we keep state in memory for the session.
interface MockOpsState {
  assignments: Record<string, { crew: string; assignedAt: string; note: string }>;
  audit: { time: string; actor: string; action: string; detail: string }[];
  resolutions: number;
}

function radbitMockApi(): Plugin {
  const opsState: MockOpsState = { assignments: {}, audit: [], resolutions: 0 };
  return {
    name: 'radbit-mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, 'http://localhost');
        const send = (status: number, obj: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(obj));
        };
        if (url.pathname === '/api/ops') {
          if (req.method === 'GET') {
            send(200, {
              assignments: Object.entries(opsState.assignments).map(([towerId, a]) => ({ towerId, ...a })),
              audit: opsState.audit,
              resolutions: opsState.resolutions
            });
            return;
          }
          if (req.method === 'POST') {
            let raw = '';
            req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
            req.on('end', () => {
              let data: Partial<MockOpsState> & { assignments?: unknown; audit?: unknown } = {};
              try {
                data = raw ? JSON.parse(raw) : {};
              } catch {
                data = {};
              }
              const assignments = Array.isArray(data.assignments)
                ? (data.assignments as { towerId: string; crew: string; assignedAt: string; note?: string }[])
                : [];
              for (const a of assignments) {
                opsState.assignments[a.towerId] = { crew: a.crew, assignedAt: a.assignedAt, note: a.note || '' };
              }
              const audit = Array.isArray(data.audit)
                ? (data.audit as { time: string; actor: string; action: string; detail: string }[])
                : [];
              const seen = new Set(opsState.audit.map((x) => `${x.time}|${x.actor}|${x.action}|${x.detail}`));
              for (const a of audit) {
                const key = `${a.time}|${a.actor}|${a.action}|${a.detail}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  opsState.audit.push(a);
                }
              }
              if (typeof data.resolutions === 'number') {
                opsState.resolutions = Math.max(opsState.resolutions, data.resolutions);
              }
              send(200, { ok: true, auditCount: opsState.audit.length });
            });
            return;
          }
          send(405, { error: 'Method not allowed. Use GET or POST /api/ops.' });
          return;
        }
        if (url.pathname === '/api/telemetry') {
          const raw = url.searchParams.get('loadShedding');
          const loadShedding = raw === 'true' || raw === '1';
          if (raw !== null && raw !== 'true' && raw !== 'false' && raw !== '1' && raw !== '0') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: "Invalid loadShedding. Use 'true' or 'false'." }));
            return;
          }
          const towers = buildTelemetry(loadShedding);
          if (url.searchParams.get('shape') === 'wrapped') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ generatedAt: new Date().toISOString(), pilot: 'Harare regional pilot (100 towers)', statutoryLimits: { cellAvailability: 67, dsasr: 95, dsdr: 2 }, towers }));
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(towers));
          return;
        }
        if (url.pathname === '/api/billing') {
          const hashedParam = url.searchParams.get('hashedMsisdn') ?? url.searchParams.get('hashed_msisdn');
          const rawMsisdn = url.searchParams.get('msisdn');
          let hashedMsisdn: string | null = null;
          if (hashedParam && /^[a-f0-9]{64}$/i.test(hashedParam)) {
            hashedMsisdn = hashedParam.toLowerCase();
          } else if (rawMsisdn) {
            const clean = rawMsisdn.replace(/[\s+()-]/g, '');
            if (!/^\d{9,15}$/.test(clean)) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid msisdn. Expected 9-15 digits.' }));
              return;
            }
            hashedMsisdn = createHmac('sha256', HMAC_SECRET).update(clean).digest('hex');
          } else {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing subscriber key. Provide hashedMsisdn (preferred) or msisdn.' }));
            return;
          }
          const usageRaw = url.searchParams.get('dataConsumed') ?? url.searchParams.get('dataUsed') ?? url.searchParams.get('dataUsedGB');
          const limitRaw = url.searchParams.get('fupLimit');

          // DB-first: mirror the seeded Neon 'subscribers' cohort so dev behaves like prod.
          const devSubscribers: Record<string, { gb: number; limit: number; throttled: boolean }> = {
            '0771111111': { gb: 4.2, limit: 100, throttled: false },
            '0771111112': { gb: 22.8, limit: 100, throttled: false },
            '0771111113': { gb: 49.6, limit: 100, throttled: false },
            '0771111114': { gb: 51.3, limit: 100, throttled: false },
            '0771111115': { gb: 75.0, limit: 100, throttled: false },
            '0771111116': { gb: 82.4, limit: 100, throttled: false },
            '0771111117': { gb: 90.9, limit: 100, throttled: false },
            '0771111118': { gb: 98.2, limit: 100, throttled: false },
            '0771111119': { gb: 100.0, limit: 100, throttled: true },
            '0771111120': { gb: 104.7, limit: 100, throttled: true },
            '0712222221': { gb: 30.5, limit: 50, throttled: false },
            '0773333333': { gb: 16.0, limit: 100, throttled: false }
          };
          const devHit = rawMsisdn ? devSubscribers[rawMsisdn.replace(/[\s+()-]/g, '')] : null;

          const dataConsumedGb = usageRaw === null ? 0 : parseFloat(usageRaw);
          const fupLimitGb = limitRaw === null ? DEFAULT_FUP_GB : parseFloat(limitRaw);
          if ((usageRaw !== null && (!Number.isFinite(dataConsumedGb) || dataConsumedGb < 0)) || !Number.isFinite(fupLimitGb) || fupLimitGb <= 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid usage values. dataConsumed must be >= 0, fupLimit > 0.' }));
            return;
          }

          const actualUsage = devHit ? devHit.gb : Math.min(dataConsumedGb, 110);
          const effLimit = devHit ? devHit.limit : fupLimitGb;
          const throttled = devHit?.throttled ?? false;
          const fupRatioPercent = Math.round((actualUsage / effLimit) * 100);
          const currentSpeedKbps = throttled || actualUsage >= effLimit ? 128 : 20000;
          const notifiedThresholds: number[] = [];
          if (fupRatioPercent >= 50) notifiedThresholds.push(50);
          if (fupRatioPercent >= 80) notifiedThresholds.push(80);
          if (fupRatioPercent >= 90) notifiedThresholds.push(90);
          if (fupRatioPercent >= 100) notifiedThresholds.push(100);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ hashedMsisdn, activePlan: `Private ${effLimit}GB FUP Limit`, dataUsedGb: parseFloat(actualUsage.toFixed(2)), fupLimitGb: effLimit, fupRatioPercent, currentSpeedKbps, notifiedThresholds }));
          return;
        }
        if (url.pathname === '/api/sms') {
          if (req.method !== 'POST') {
            send(405, { error: 'Method not allowed. Use POST /api/sms.' });
            return;
          }
          let raw = '';
          req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
          req.on('end', () => {
            let body: Record<string, unknown> = {};
            try {
              body = raw ? JSON.parse(raw) : {};
            } catch {
              body = {};
            }
            const hashedMsisdn = typeof body.hashedMsisdn === 'string' ? body.hashedMsisdn : '';
            const message = typeof body.message === 'string' ? body.message : '';
            if (!hashedMsisdn || !/^[a-f0-9]{64}$/i.test(hashedMsisdn) || !message) {
              send(400, { error: 'Missing or invalid hashedMsisdn/message.' });
              return;
            }
            const latencyMs = 120 + Math.floor(Math.random() * 1180);
            send(200, {
              status: 'sent',
              simulated: true,
              messageId: `sms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              dispatchedAt: new Date().toISOString(),
              latencyMs,
              slaMs: 1500,
              slaMet: latencyMs < 1500,
              payload: {
                channel: 'SMS',
                destinationHash: `${hashedMsisdn.slice(0, 12)}…${hashedMsisdn.slice(-6)}`,
                thresholdPct: Number(body.thresholdPct),
                message
              }
            });
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), radbitMockApi()],
  server: { port: 5173 }
});
