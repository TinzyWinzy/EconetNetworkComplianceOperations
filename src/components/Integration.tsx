import { FileDown, Plug, Lock, ShieldCheck, Database, Activity, CreditCard } from 'lucide-react';

function FieldRow({ field, limit, use }: { field: string; limit: string; use: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-3 font-mono text-xs text-slate-800">{field}</td>
      <td className="tnum py-2 pr-3 text-xs text-slate-600">{limit}</td>
      <td className="py-2 text-xs text-slate-600">{use}</td>
    </tr>
  );
}

/**
 * Served integration explainer: how the sidecar connects to Econet, what data
 * it needs, and how that data is fetched and used. Grounded in the PRD,
 * technical-specs-erd.md and api-integration-spec.md.
 */
export default function Integration() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Integration overview">
        <div className="flex items-center gap-2">
          <Plug size={18} className="text-[#2d358b]" />
          <h2 className="font-bold text-slate-900">How the system connects</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This is a <strong>read-only sidecar</strong> — it sits <em>beside</em> Econet&apos;s core, never inside it.
          It consumes two anonymised feeds (network performance + billing usage), stores them in an isolated database,
          and produces alerts, a live map and a POTRAZ dossier. It has <strong>no write path</strong> back to switches or
          charging, so a failure here cannot drop a call or corrupt a bill.
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-[#0e2a47]/[0.04] p-3">
            <p className="font-semibold text-slate-900">1 · Econet core</p>
            <p className="text-xs text-slate-500">RAN / OSS performance data + OCS billing usage, pushed read-only</p>
          </div>
          <div className="rounded-xl bg-[#0e2a47]/[0.04] p-3">
            <p className="font-semibold text-slate-900">2 · Ingestion boundary</p>
            <p className="text-xs text-slate-500">TLS 1.3 · Bearer JWT · raw MSISDN hashed in Econet&apos;s HSM, never stored</p>
          </div>
          <div className="rounded-xl bg-[#0e2a47]/[0.04] p-3">
            <p className="font-semibold text-slate-900">3 · RadBit sidecar</p>
            <p className="text-xs text-slate-500">Isolated Postgres (AES-256) → threshold engine → alerts, map, dossier</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Module 1 data requirements">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-[#2d358b]" />
          <h3 className="font-bold text-slate-900">Module 1 — network QoS data (from the NOC / OSS)</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">Per tower, hourly or event-driven. The source is Econet&apos;s existing performance-management system — no new probes required.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1 pr-3">Field</th>
                <th scope="col" className="py-1 pr-3">SI 154 limit</th>
                <th scope="col" className="py-1">Used for</th>
              </tr>
            </thead>
            <tbody>
              <FieldRow field="tower_id · name · lat/long · region" limit="—" use="Map, fleet view, dossier schedule" />
              <FieldRow field="cell_availability_pct (CA)" limit="≥ 67%" use="Uptime breach → US$200/tower-month" />
              <FieldRow field="dsasr_pct (access success)" limit="≥ 95%" use="Early-warning + breach alert" />
              <FieldRow field="dsdr_pct (drop rate)" limit="≤ 2%" use="Early-warning + breach alert" />
              <FieldRow field="dcr_pct / cssr_pct (voice)" limit="symmetrical" use="Voice KPI breach tracking" />
              <FieldRow field="status · outage_start" limit="< 3 hrs" use="Outage clock → US$5,000/hr fine" />
              <FieldRow field="power source (grid/battery/gen)" limit="—" use="Route diesel crews before 3 hrs" />
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Module 2 data requirements">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-[#2d358b]" />
          <h3 className="font-bold text-slate-900">Module 2 — billing / usage data (from the OCS / charging)</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">Per subscriber, per session. Identity is anonymised at the source — we never see the raw number.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1 pr-3">Field</th>
                <th scope="col" className="py-1 pr-3">Constraint</th>
                <th scope="col" className="py-1">Used for</th>
              </tr>
            </thead>
            <tbody>
              <FieldRow field="hashed_msisdn (HMAC-SHA256)" limit="64-hex, zero-PII" use="Deterministic subscriber join key" />
              <FieldRow field="hsm_key_id" limit="salt version" use="Key rotation without re-keying" />
              <FieldRow field="data_balance_bytes · fup_limit_gb" limit="—" use="FUP ratio → 50/80/90/100% alerts" />
              <FieldRow field="bytes_consumed by category" limit="Video/Social/Browsing/…" use="Granular usage analytics portal" />
              <FieldRow field="fup_throttled" limit="boolean" use="Current speed state (4G vs 128Kbps)" />
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Connection options">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-[#2d358b]" />
          <h3 className="font-bold text-slate-900">How we get the data — three options</h3>
        </div>
        <ul className="mt-2 space-y-2 text-sm text-slate-600">
          <li>
            <strong className="text-slate-900">1 · REST push (recommended for pilot).</strong>{' '}
            Econet&apos;s OSS/OCS posts JSON to our <code className="rounded bg-slate-100 px-1 text-xs">/api/v1/telemetry/tower</code> and{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">/api/v1/billing/usage</code> endpoints (Bearer JWT, hourly or event-driven).
            Lowest risk, easiest to stand up — the API contract is in the OpenAPI spec below.
          </li>
          <li>
            <strong className="text-slate-900">2 · Event stream (Kafka/gRPC).</strong>{' '}
            Near-real-time, required for the live 2-hour outage shield and the sub-1.5s SMS alert. More integration effort.
          </li>
          <li>
            <strong className="text-slate-900">3 · Daily file batch (SFTP / CSV).</strong>{' '}
            Fallback if real-time feeds are blocked. Still unlocks the dossier and the 80-hours/month reporting saving — just not the live shield.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Safety guarantees">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-[#2d358b]" />
          <h3 className="font-bold text-slate-900">Safety &amp; what we don&apos;t need</h3>
        </div>
        <div className="mt-2 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <ul className="space-y-1.5">
            <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-700" /> Read-only — no write path to switches or charging.</li>
            <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-700" /> Zero-PII — raw MSISDN hashed in Econet&apos;s HSM boundary.</li>
            <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-700" /> TLS 1.3 in transit, AES-256 at rest.</li>
          </ul>
          <ul className="space-y-1.5">
            <li className="flex gap-2"><span className="text-red-600">✕</span> No call-routing or billing write access.</li>
            <li className="flex gap-2"><span className="text-red-600">✕</span> No message/SMS content or voice payloads.</li>
            <li className="flex gap-2"><span className="text-red-600">✕</span> No customer names, addresses or location history.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl bg-[#2d358b] p-4 text-white shadow-sm" aria-label="API specification">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold">API contract — OpenAPI 3.1</h3>
            <p className="text-xs text-blue-100">The exact endpoints, parameters and schemas Econet&apos;s team needs to build the feed.</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/openapi.yaml"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-[#2d358b]"
            >
              View spec
            </a>
            <a
              href="/openapi.yaml"
              download
              className="flex items-center gap-1.5 rounded-lg bg-[#c80f22] px-3 py-1.5 text-sm font-bold text-white"
            >
              <FileDown size={15} /> Download YAML
            </a>
          </div>
        </div>
        <p className="tnum mt-2 text-[11px] text-blue-200">
          Endpoints: GET /api/telemetry · GET /api/billing · GET/POST /api/ops · POST /api/sms · (planned) POST /api/v1/telemetry/tower · /api/v1/billing/usage.
          View in any OpenAPI tool — Postman, Stoplight, Swagger Editor.
        </p>
      </section>
    </div>
  );
}
