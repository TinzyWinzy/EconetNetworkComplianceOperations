import { useEffect, useState } from 'react';
import { Siren } from 'lucide-react';
import { TowerTelemetry, SI_LIMITS } from '../types';
import { penaltyForElapsed } from '../lib/exposure';

function fmt(sec: number): string {
  const a = Math.abs(sec);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(a / 3600))}:${pad(Math.floor((a % 3600) / 60))}:${pad(Math.floor(a % 60))}`;
}

/** Active outage incidents derived from live telemetry — no staged fixtures. */
export default function Incidents({ towers }: { towers: TowerTelemetry[] }) {
  const incidents = towers
    .filter((t) => t.status === 'Offline' && t.activeOutageDurationMinutes > 0)
    .sort((a, b) => b.activeOutageDurationMinutes - a.activeOutageDurationMinutes);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  void now;

  if (incidents.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Active incidents">
        <div className="flex items-center gap-2">
          <Siren size={18} className="text-emerald-800" />
          <h2 className="font-bold text-slate-900">Active incidents</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">No active outages. All sites reporting inside the 3-hour SI 154 service window.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Active incidents">
      <div className="flex items-center gap-2">
        <Siren size={18} className="text-red-700" />
        <h2 className="font-bold text-slate-900">Active incidents · {incidents.length}</h2>
      </div>
      <ol className="mt-2 divide-y divide-slate-100">
        {incidents.slice(0, 5).map((t) => {
          const elapsedSec = t.activeOutageDurationMinutes * 60;
          const remaining = SI_LIMITS.outageFreeMinutes * 60 - elapsedSec;
          const fine = penaltyForElapsed(elapsedSec);
          return (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{t.name} <span className="tnum font-normal text-slate-400">{t.id}</span></p>
                <p className="tnum text-xs text-slate-500">Outage {t.activeOutageDurationMinutes}m · SLA {remaining > 0 ? `${fmt(remaining)} remaining` : `${fmt(remaining)} over`}</p>
              </div>
              <span className={`tnum shrink-0 rounded px-2 py-1 text-xs font-bold ${fine > 0 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
                {fine > 0 ? `US$${fine.toLocaleString()} fined` : 'Inside window'}
              </span>
            </li>
          );
        })}
      </ol>
      {incidents.length > 5 && <p className="tnum mt-1 text-xs text-slate-500">+{incidents.length - 5} further incidents in Tower fleet.</p>}
    </section>
  );
}
