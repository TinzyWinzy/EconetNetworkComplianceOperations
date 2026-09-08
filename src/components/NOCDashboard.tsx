import { TowerTelemetry } from '../types';
import { Donut, BarList, ChartCard, fleetStatusData, caBands } from './Charts';

function avg(ts: TowerTelemetry[], f: (t: TowerTelemetry) => number): string {
  if (ts.length === 0) return '—';
  return (ts.reduce((s, t) => s + f(t), 0) / ts.length).toFixed(1);
}

/** Fleet status at a glance: banner first, KPIs second, visualisations third. */
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
      <div className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-2">
        <ChartCard title="Fleet status" subtitle="How the 100 pilot sites are powered right now">
          <Donut data={fleetStatusData(towers)} />
        </ChartCard>
        <ChartCard title="Cell availability bands" subtitle="Sites by CA% — the first SI 154 bar is anything under 67%">
          <BarList
            rows={caBands(towers)}
            bandColor={(v) => (v > 0 ? '#ef4444' : '#cbd5e1')}
          />
        </ChartCard>
      </div>
    </section>
  );
}
