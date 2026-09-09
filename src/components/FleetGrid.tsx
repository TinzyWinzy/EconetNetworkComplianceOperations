import { useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { TowerTelemetry, CrewAssignment, SI_LIMITS } from '../types';

function regionOf(t: TowerTelemetry): string {
  return t.name.split(' Base-Station')[0];
}

const dot = (t: TowerTelemetry) =>
  t.cellAvailabilityPercent < SI_LIMITS.cellAvailability || t.status === 'Offline'
    ? 'bg-red-600'
    : t.status === 'Backup Battery'
      ? 'bg-amber-400'
      : 'bg-emerald-600';

type Filter = 'All' | 'Offline' | 'Backup Battery' | 'KPI breach';

/** Full fleet view with search + status filter + per-site crew assignment. */
export default function FleetGrid({
  towers,
  loading,
  assignments,
  onAssign,
  readOnly = false
}: {
  towers: TowerTelemetry[];
  loading: boolean;
  assignments: Map<string, CrewAssignment>;
  onAssign: (towerId: string) => void;
  readOnly?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return towers.filter((t) => {
      if (filter === 'Offline' && t.status !== 'Offline') return false;
      if (filter === 'Backup Battery' && t.status !== 'Backup Battery') return false;
      if (filter === 'KPI breach' && !(t.cellAvailabilityPercent < SI_LIMITS.cellAvailability || t.dsasrPercent < SI_LIMITS.dsasr || t.dsdrPercent > SI_LIMITS.dsdr)) return false;
      if (q && !`${t.id} ${t.name} ${t.status}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [towers, filter, query]);

  const groups = useMemo(() => {
    const m = new Map<string, TowerTelemetry[]>();
    for (const t of filtered) {
      const r = regionOf(t);
      if (!m.has(r)) m.set(r, []);
      m.get(r)!.push(t);
    }
    return [...m.entries()];
  }, [filtered]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Tower fleet">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900">Tower fleet · <span className="tnum">{filtered.length}/{towers.length}</span> sites</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search site or ID"
              className="rounded-lg border border-slate-300 py-1.5 pl-7 pr-2 text-sm"
              aria-label="Search sites"
            />
          </label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" aria-label="Filter by status">
            {(['All', 'Offline', 'Backup Battery', 'KPI breach'] as Filter[]).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500" aria-label="Status legend">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Online</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> Backup battery</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-600" /> Offline / KPI breach</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm outline outline-2 outline-offset-1 outline-blue-700" /> Crew assigned</span>
      </div>

      {loading && towers.length === 0 ? (
        <div className="mt-3 grid grid-cols-10 gap-1" aria-label="Loading fleet">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded-sm bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No sites match this filter.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map(([region, ts]) => (
            <div key={region}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{region} · {ts.length}</p>
              <div className="flex flex-wrap gap-1">
                {ts.map((t) => (
                  <button
                    key={t.id}
                    title={`${t.id} ${t.name} — ${t.status}, CA ${t.cellAvailabilityPercent}%`}
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                    className={`h-5 w-5 rounded-sm ${dot(t)} ${assignments.has(t.id) ? 'outline outline-2 outline-offset-1 outline-blue-700' : ''}`}
                    aria-label={`${t.id} ${t.name} ${t.status}`}
                  />
                ))}
              </div>
              {ts.some((t) => t.id === expanded) && (
                <SiteDetail tower={ts.find((t) => t.id === expanded)!} assigned={assignments.get(expanded!)} onAssign={onAssign} readOnly={readOnly} />
              )}
            </div>
          ))}
        </div>
      )}
      <p className="tnum mt-2 flex items-center gap-1 text-xs text-slate-500">
        <RefreshCw size={12} /> Live feed refreshes automatically · outlined sites have crews assigned · select a site for detail.
      </p>
    </section>
  );
}

function SiteDetail({ tower: t, assigned, onAssign, readOnly }: { tower: TowerTelemetry; assigned?: CrewAssignment; onAssign: (id: string) => void; readOnly: boolean }) {
  return (
    <div className="tnum mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
      <span className="font-bold text-slate-900">{t.id} {t.name}</span> · {t.status} · CA {t.cellAvailabilityPercent}% · DSASR {t.dsasrPercent}% · DSDR {t.dsdrPercent}%
      {t.activeOutageDurationMinutes > 0 && ` · outage ${t.activeOutageDurationMinutes}m`}
      {assigned ? (
        <span className="ml-2 font-semibold text-blue-800">Crew {assigned.crew} · {new Date(assigned.assignedAt).toLocaleTimeString()}</span>
      ) : readOnly ? (
        <span className="ml-2 text-slate-400">Unassigned — NOC action pending</span>
      ) : (
        <button onClick={() => onAssign(t.id)} className="ml-2 rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold hover:bg-slate-100">
          Assign crew
        </button>
      )}
    </div>
  );
}
