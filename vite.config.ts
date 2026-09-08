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
function radbitMockApi(): Plugin {
  return {
    name: 'radbit-mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, 'http://localhost');
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
          const dataConsumedGb = usageRaw === null ? 0 : parseFloat(usageRaw);
          const fupLimitGb = limitRaw === null ? DEFAULT_FUP_GB : parseFloat(limitRaw);
          if ((usageRaw !== null && (!Number.isFinite(dataConsumedGb) || dataConsumedGb < 0)) || !Number.isFinite(fupLimitGb) || fupLimitGb <= 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid usage values. dataConsumed must be >= 0, fupLimit > 0.' }));
            return;
          }
          const actualUsage = Math.min(dataConsumedGb, 110);
          const fupRatioPercent = Math.round((actualUsage / fupLimitGb) * 100);
          const currentSpeedKbps = actualUsage >= fupLimitGb ? 128 : 20000;
          const notifiedThresholds: number[] = [];
          if (fupRatioPercent >= 50) notifiedThresholds.push(50);
          if (fupRatioPercent >= 80) notifiedThresholds.push(80);
          if (fupRatioPercent >= 90) notifiedThresholds.push(90);
          if (fupRatioPercent >= 100) notifiedThresholds.push(100);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ hashedMsisdn, activePlan: `Private ${fupLimitGb}GB FUP Limit`, dataUsedGb: parseFloat(actualUsage.toFixed(2)), fupLimitGb, fupRatioPercent, currentSpeedKbps, notifiedThresholds }));
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
