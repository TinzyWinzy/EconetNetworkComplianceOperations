import { useState } from 'react';
import { Search, Send, CheckCircle2 } from 'lucide-react';
import { SubscriberProfile } from '../types';

const THRESHOLDS = [50, 80, 90, 100];

/** Care workspace: look up a subscriber, see FUP state, act without a phone call. */
export default function SubscriberCare({ onResolve, readOnly = false }: { onResolve: (detail: string) => void; readOnly?: boolean }) {
  const [key, setKey] = useState('');
  const [profile, setProfile] = useState<SubscriberProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const lookup = async () => {
    const k = key.trim();
    if (!k) return;
    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const param = /^[a-f0-9]{64}$/i.test(k) ? `hashedMsisdn=${encodeURIComponent(k)}` : `msisdn=${encodeURIComponent(k)}`;
      const r = await fetch(`/api/billing?${param}`);
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error((j && j.error) || `Billing service responded ${r.status}`);
      }
      setProfile(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Subscriber care">
      <h2 className="font-bold text-slate-900">Subscriber care</h2>
      <div className="mt-2 flex gap-2">
        <label className="relative flex-1">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            placeholder="MSISDN or hashed ID"
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-7 pr-2 text-sm"
            aria-label="Subscriber key"
            inputMode="numeric"
          />
        </label>
        <button onClick={lookup} disabled={loading || !key.trim()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
          {loading ? 'Loading…' : 'Look up'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}

      {!profile && !error && (
        <p className="mt-3 text-sm text-slate-500">Enter a subscriber MSISDN to see live FUP state, thresholds hit and throttle status. Raw numbers are hashed at the gateway — only the HMAC leaves it.</p>
      )}

      {profile && (
        <div className="mt-3">
          <p className="text-sm font-bold text-slate-900">{profile.activePlan}</p>
          <p className="tnum text-sm text-slate-600">
            {profile.dataUsedGb.toFixed(1)} / {profile.fupLimitGb}GB ({profile.fupRatioPercent}%) ·{' '}
            {profile.currentSpeedKbps >= 20000 ? '4G full speed' : 'Throttled 128Kbps'}
          </p>
          <div className="mt-1 h-2 rounded bg-slate-200">
            <div
              className={`h-2 rounded ${profile.fupRatioPercent >= 100 ? 'bg-red-600' : profile.fupRatioPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-600'}`}
              style={{ width: `${Math.min(100, profile.fupRatioPercent)}%` }}
            />
          </div>
          <ol className="mt-2 space-y-1">
            {THRESHOLDS.map((t) => {
              const hit = profile.notifiedThresholds.includes(t);
              return (
                <li key={t} className="flex items-center gap-2 text-sm">
                  {hit ? <CheckCircle2 size={14} className="text-emerald-700" /> : <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />}
                  <span className={hit ? 'text-slate-800' : 'text-slate-400'}>{t}% alert {hit ? 'sent' : 'pending'}</span>
                </li>
              );
            })}
          </ol>
          <p className="tnum mt-2 break-all text-[11px] text-slate-400">id {profile.hashedMsisdn.slice(0, 16)}… · zero raw PII stored</p>
          <div className="mt-2 flex gap-2">
            {readOnly ? (
              <p className="text-xs text-slate-400">Oversight view — care actions are taken by the care team.</p>
            ) : (
              <>
            <button
              onClick={() => { setSent(true); onResolve(`Top-up offer sent to …${profile.hashedMsisdn.slice(-6)} at ${profile.fupRatioPercent}% FUP`); }}
              className="flex items-center gap-1 rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-semibold text-white"
            >
              <Send size={14} /> {sent ? 'Offer sent' : 'Send top-up offer'}
            </button>
            <button onClick={() => onResolve(`Care case resolved for …${profile.hashedMsisdn.slice(-6)} without a call-centre ticket`)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">
              Log resolution
            </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
