import { TowerTelemetry, SI_LIMITS } from '../types';
import { Donut, BarList, ChartCard, fleetStatusData, caBands } from './Charts';
import { riskLevel } from '../lib/exposure';

function avg(ts: TowerTelemetry[], f: (t: TowerTelemetry) => number): string {
  if (ts.length === 0) return '—';
  return (ts.reduce((s, t) => s + f(t), 0) / ts.length).toFixed(1);
}

/** Fleet status at a glance: banner first, KPIs second, visualisations third. */
export default function NOCDashboard({ towers, openCases }: { towers: TowerTelemetry[]; openCases: number }) {
  const breaches = towers.filter(
    (t) => t.cellAvailabilityPercent < SI_LIMITS.cellAvailability || t.dsasrPercent < SI_LIMITS.dsasr || t.dsdrPercent > SI_LIMITS.dsdr
  ).length;
  const warnings = towers.filter((t) => riskLevel(t) === 'HIGH' || riskLevel(t) === 'MEDIUM').length;
  const offline = towers.filter((t) => t.status === 'Offline').length;
  const ok = breaches === 0 && warnings === 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Network status">
      <div className={`px-4 py-2 text-sm font-semibold ${ok ? 'bg-emerald-800 text-white' : 'bg-red-800 text-white'}`}>
        {ok
          ? 'All 100 sites inside SI 154 limits'
          : `${breaches} breach · ${warnings} early-warning · ${offline} offline · ${openCases} open ${openCases === 1 ? 'case' : 'cases'}`}
      </div>
      <div className="tnum grid grid-cols-3 divide-x divide-slate-100 text-center">
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Breach sites</p>
          <p className={`text-2xl font-bold ${breaches > 0 ? 'text-red-700' : 'text-slate-900'}`}>{breaches}</p>
          <p className="text-[11px] text-slate-400">avg CA {towers.length ? `${avg(towers, (t) => t.cellAvailabilityPercent)}%` : '—'}</p>
        </div>
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Early-warning</p>
          <p className={`text-2xl font-bold ${warnings > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{warnings}</p>
          <p className="text-[11px] text-slate-400">avg DSASR {towers.length ? `${avg(towers, (t) => t.dsasrPercent)}%` : '—'}</p>
        </div>
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Offline</p>
          <p className={`text-2xl font-bold ${offline > 0 ? 'text-red-700' : 'text-slate-900'}`}>{offline}</p>
          <p className="text-[11px] text-slate-400">avg DSDR {towers.length ? `${avg(towers, (t) => t.dsdrPercent)}%` : '—'}</p>
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
