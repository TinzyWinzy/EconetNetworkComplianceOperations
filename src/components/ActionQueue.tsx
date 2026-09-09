import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { TowerTelemetry, CrewAssignment } from '../types';
import { exposureOf, outageFine } from '../lib/exposure';

const CREWS = ['Crew A — North', 'Crew B — South', 'Crew C — East', 'Crew D — West', 'Contractor — Diesel'];

/** Ranked remediation queue: fine-priced sites first, crew assignment logged. */
export default function ActionQueue({
  towers,
  assignments,
  onAssign,
  readOnly = false
}: {
  towers: TowerTelemetry[];
  assignments: Map<string, CrewAssignment>;
  onAssign: (towerId: string, crew: string) => void;
  readOnly?: boolean;
}) {
  const [crewPick, setCrewPick] = useState<Record<string, string>>({});
  const queue = towers
    .map((t) => ({ t, exposure: exposureOf(t), assigned: assignments.get(t.id) }))
    .filter((r) => r.exposure > 0 && !r.assigned)
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 8);
  const done = assignments.size;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Remediation queue">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-slate-800" />
        <h2 className="font-bold text-slate-900">Remediation queue</h2>
      </div>
      {queue.length === 0 ? (
        <p className="mt-2 text-sm text-emerald-800">
          Queue clear — no fine-priced sites outstanding.{done > 0 && ` ${done} assignment${done === 1 ? '' : 's'} logged this shift.`}
        </p>
      ) : (
        <ol className="mt-2 divide-y divide-slate-100">
          {queue.map(({ t }, idx) => {
            const out = outageFine(t);
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    <span className="tnum mr-2 text-slate-400">{idx + 1}.</span>
                    {t.name} <span className="tnum font-normal text-slate-400">{t.id}</span>
                  </p>
                  <p className="tnum text-xs text-slate-500">
                    CA {t.cellAvailabilityPercent}% · DSASR {t.dsasrPercent}% · DSDR {t.dsdrPercent}%
                    {t.activeOutageDurationMinutes > 0 && ` · outage ${t.activeOutageDurationMinutes}m`}
                    <span className="ml-1 font-semibold text-blue-800">· Crew ETA ~45m after assign</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tnum rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-800">
                    US${exposureOf(t).toLocaleString()}{out > 0 ? '' : '/mo'}
                  </span>
                  {readOnly ? (
                    <span className="text-xs text-slate-400">NOC assignment pending</span>
                  ) : (
                    <>
                  <select
                    value={crewPick[t.id] ?? CREWS[idx % CREWS.length]}
                    onChange={(e) => setCrewPick((p) => ({ ...p, [t.id]: e.target.value }))}
                    className="min-h-[44px] rounded border border-slate-300 px-2 py-2 text-xs"
                    aria-label={`Crew for ${t.id}`}
                  >
                    {CREWS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onAssign(t.id, crewPick[t.id] ?? CREWS[idx % CREWS.length])}
                    className="min-h-[44px] rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Assign
                  </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
