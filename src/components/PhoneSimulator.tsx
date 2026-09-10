import { useRef, useState } from 'react';
import { CheckCircle2, Gauge, Smartphone, Zap } from 'lucide-react';

const THRESHOLDS = [50, 80, 90, 100];

const MESSAGES: Record<number, string> = {
  50: "Econet Data Trust: You've used 50% of your high-speed allowance. Enjoy full speeds!",
  80: 'Heads up: 80% of high-speed FUP used. Speeds adjust to 128Kbps at 100%. Tap EXTEND to stay uncapped.',
  90: "90% used — you're nearly at the FUP cap. At 100% speeds drop to 128Kbps.",
  100: 'FUP cap reached. Speed now 128Kbps. ONE-CLICK EXTEND: add 10GB booster for US$3.00.'
};

// Demo placeholder hash — no real MSISDN. /api/sms validates 64-hex only.
const DEMO_HASH = 'a'.repeat(64);

interface DispatchEntry {
  id: string;
  threshold: number;
  message: string;
  latencyMs: number;
  slaMet: boolean;
  at: string;
  offline?: boolean;
  acked?: boolean;
}

/**
 * Customer-facing "My-Data" phone simulator (Module 2).
 * Dragging usage past 50/80/90/100% dispatches an SMS through the gateway
 * simulator and measures delivery latency against the <1.5s SLA — the
 * anti-bill-shock journey Fungai can message publicly.
 */
export default function PhoneSimulator({ onDeflect }: { onDeflect: (detail: string) => void }) {
  const [planGb, setPlanGb] = useState(100);
  const [usageGb, setUsageGb] = useState(35);
  const [log, setLog] = useState<DispatchEntry[]>([]);
  const [sending, setSending] = useState(false);
  const dispatchedRef = useRef<Set<number>>(new Set());

  const pct = Math.round((usageGb / planGb) * 100);
  const throttled = pct >= 100;

  const dispatchSms = async (threshold: number) => {
    dispatchedRef.current.add(threshold);
    setSending(true);
    try {
      const r = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashedMsisdn: DEMO_HASH, thresholdPct: threshold, message: MESSAGES[threshold] })
      });
      const j = await r.json();
      setLog((prev) => [
        { id: j.messageId ?? '', threshold, message: MESSAGES[threshold], latencyMs: j.latencyMs ?? 0, slaMet: j.slaMet ?? true, at: new Date().toISOString() },
        ...prev
      ]);
    } catch {
      setLog((prev) => [
        { id: 'local', threshold, message: MESSAGES[threshold], latencyMs: 0, slaMet: true, at: new Date().toISOString(), offline: true },
        ...prev
      ]);
    } finally {
      setSending(false);
    }
  };

  const onSlider = (v: number) => {
    setUsageGb(v);
    const newPct = Math.round((v / planGb) * 100);
    for (const t of THRESHOLDS) {
      if (newPct >= t && !dispatchedRef.current.has(t)) dispatchSms(t);
    }
  };

  const resetFor = (gb: number) => {
    setPlanGb(gb);
    setUsageGb(Math.min(usageGb, gb));
    setLog([]);
    dispatchedRef.current = new Set();
  };

  const ack = (id: string, detail: string) => {
    setLog((prev) => prev.map((e) => (e.id === id ? { ...e, acked: true } : e)));
    onDeflect(detail);
  };

  const extend = () => {
    onDeflect('FUP booster purchased (10GB for US$3.00) — no support call');
    setUsageGb(Math.max(0, usageGb - 10));
  };

  const ackedCount = log.filter((e) => e.acked).length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Phone */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Customer phone simulator">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><Smartphone size={18} /> My-Data portal</h2>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs" role="group" aria-label="Plan size">
            {[50, 100].map((g) => (
              <button key={g} onClick={() => resetFor(g)} className={`rounded px-2 py-1 font-semibold ${planGb === g ? 'bg-[#2d358b] text-white' : 'text-slate-600'}`}>
                {g}GB
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-3 w-full max-w-[290px] rounded-[2rem] border-8 border-slate-900 bg-slate-50 p-3 shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
            <span>Econet 4G</span>
            <span className="font-bold text-slate-800">My-Data</span>
            <span className="tnum">09:41</span>
          </div>

          <div className="mt-2 rounded-xl bg-white p-3 shadow-sm">
            <p className="text-sm font-bold text-slate-900">Hi Tinashe</p>
            <p className="text-xs text-slate-500">Private {planGb}GB FUP plan</p>
            <div className="tnum mt-2 text-2xl font-bold text-slate-900">
              {usageGb.toFixed(0)}<span className="text-sm text-slate-400"> / {planGb} GB</span>
            </div>
            <div className="mt-1 h-2 rounded bg-slate-200">
              <div className={`h-2 rounded ${pct >= 100 ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="tnum mt-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
              <Zap size={12} /> {throttled ? 'Throttled 128Kbps' : '4G full speed'} · {pct}% of allowance
            </p>

            <input
              type="range"
              min={0}
              max={planGb}
              step={1}
              value={usageGb}
              onChange={(e) => onSlider(Number(e.target.value))}
              className="mt-3 w-full accent-[#2d358b]"
              aria-label="Simulate data usage"
            />
            <p className="text-[10px] text-slate-400">Drag to simulate consumption past 50 / 80 / 90 / 100%.</p>
          </div>

          {/* Notification bubbles */}
          <div className="mt-2 space-y-1.5">
            {log.length === 0 && (
              <p className="rounded-lg bg-white px-2 py-1.5 text-[11px] text-slate-400">No alerts yet — push the slider to 50%.</p>
            )}
            {log.map((e) => (
              <div key={e.id} className={`rounded-lg border px-2 py-1.5 text-[11px] ${e.acked ? 'border-slate-200 bg-white text-slate-400' : 'border-amber-300 bg-amber-50 text-slate-700'}`}>
                <p className="font-bold">Econet Data Trust · {e.threshold}%</p>
                <p className="text-slate-600">{e.message}</p>
                <div className="mt-1 flex items-center gap-2">
                  {e.acked ? (
                    <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={11} /> Acknowledged</span>
                  ) : (
                    <>
                      <button onClick={() => ack(e.id, 'FUP alert self-served — no support call')} className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Got it
                      </button>
                      {e.threshold >= 80 && (
                        <button onClick={() => { ack(e.id, 'FUP EXTEND self-served — no support call'); extend(); }} className="rounded bg-[#c80f22] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          EXTEND
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gateway / SLA log */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Notification gateway dispatch log">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><Gauge size={18} /> Notification gateway</h2>
        <p className="mt-0.5 text-xs text-slate-500">Simulated SMS/push dispatch with delivery-latency tracking against the &lt;1.5s SLA (NFR-1.3).</p>

        <div className="tnum mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-[11px] uppercase text-slate-500">Dispatched</p>
            <p className="text-xl font-bold text-slate-900">{log.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-[11px] uppercase text-slate-500">Self-served</p>
            <p className="text-xl font-bold text-emerald-700">{ackedCount}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-[11px] uppercase text-slate-500">Saved</p>
            <p className="text-xl font-bold text-[#c80f22]">US${(ackedCount * 10).toLocaleString()}</p>
          </div>
        </div>

        <ol className="mt-3 divide-y divide-slate-100">
          {log.map((e) => (
            <li key={e.id} className="tnum flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate text-slate-700">
                <span className="font-semibold text-slate-900">{e.threshold}%</span> alert
              </span>
              {e.offline ? (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">offline</span>
              ) : (
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${e.slaMet ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {e.latencyMs}ms · {e.slaMet ? 'SLA met' : 'SLA miss'}
                </span>
              )}
            </li>
          ))}
          {log.length === 0 && <p className="py-1 text-sm text-slate-400">No dispatches yet.</p>}
        </ol>

        <p className="mt-2 text-[11px] text-slate-500">
          {sending ? 'Dispatching…' : 'Each threshold dispatch is logged with its delivery latency. Every self-served alert avoids a US$10 call-centre interaction.'}
        </p>
      </section>
    </div>
  );
}
