import { TowerTelemetry } from '../types';

function avg(ts: TowerTelemetry[], f: (t: TowerTelemetry) => number): string {
  if (ts.length === 0) return '—';
  return (ts.reduce((s, t) => s + f(t), 0) / ts.length).toFixed(1);
}

/** Fleet status at a glance: banner first, KPIs second. */
export default function NOCDashboard({ towers, openCases }: { towers: TowerTelemetry[]; openCases: number }) {
  const breaches = towers.filter(
    (t) => t.cellAvailabilityPercent < 67 || t.dsasrPercent < 95 || t.dsdrPercent > 2
  ).length;
  const offline = towers.filter((t) => t.status === 'Offline').length;
  const ok = breaches === 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Network status">
      <div className={`px-4 py-2 text-sm font-semibold ${ok ? 'bg-emerald-800 text-white' : 'bg-red-800 text-white'}`}>
        {ok
          ? 'All 100 sites inside SI 154 limits'
          : `${breaches} sites breach SI 154 · ${offline} offline · ${openCases} open ${openCases === 1 ? 'case' : 'cases'}`}
      </div>
      <div className="tnum grid grid-cols-3 divide-x divide-slate-100 text-center">
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cell avail ≥67%</p>
          <p className="text-2xl font-bold text-slate-900">{towers.length ? `${avg(towers, (t) => t.cellAvailabilityPercent)}%` : '—'}</p>
        </div>
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">DSASR ≥95%</p>
          <p className="text-2xl font-bold text-slate-900">{towers.length ? `${avg(towers, (t) => t.dsasrPercent)}%` : '—'}</p>
        </div>
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">DSDR ≤2%</p>
          <p className="text-2xl font-bold text-slate-900">{towers.length ? `${avg(towers, (t) => t.dsdrPercent)}%` : '—'}</p>
        </div>
      </div>
    </section>
  );
}
