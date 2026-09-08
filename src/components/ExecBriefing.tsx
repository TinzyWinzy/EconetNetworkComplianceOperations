import { FileDown, ShieldCheck, Megaphone, Scale } from 'lucide-react';
import { AuditEntry, FinancialROIState, TowerTelemetry } from '../types';
import { exposureOf } from '../lib/exposure';
import { Donut, BarList, ChartCard, fleetStatusData, caBands } from './Charts';

/**
 * Fungai Mandiveyi's view: posture at a glance, evidence for POTRAZ,
 * customer-trust numbers for public messaging. Read-only by design.
 */
export default function ExecBriefing({
  towers,
  roi,
  resolutions,
  audit,
  lastUpdated
}: {
  towers: TowerTelemetry[];
  roi: FinancialROIState;
  resolutions: number;
  audit: AuditEntry[];
  lastUpdated: string | null;
}) {
  const offline = towers.filter((t) => t.status === 'Offline');
  const battery = towers.filter((t) => t.status === 'Backup Battery');
  const worst = [...towers].sort((a, b) => exposureOf(b) - exposureOf(a)).slice(0, 3);
  const posture = offline.length === 0 ? 'nominal' : offline.length <= 3 ? 'watch' : 'action';

  const exportEvidence = () => {
    const lines = [
      'ECONET COMPLIANCE EVIDENCE PACK',
      `Generated,${new Date().toISOString()}`,
      `Source,Harare pilot — 100 sites`,
      '',
      'POSTURE',
      `Open fine-priced sites,${towers.filter((t) => exposureOf(t) > 0).length}`,
      `Offline sites,${offline.length}`,
      `On backup power,${battery.length}`,
      `Live exposure USD,${roi.unmitigatedExposuresUsd}`,
      `Shielded USD,${roi.mitigatedSavingsUsd}`,
      '',
      'TOP EXPOSURES',
      'tower_id,site,status,ca_pct,outage_min,exposure_usd',
      ...worst.map((t) => `${t.id},"${t.name}",${t.status},${t.cellAvailabilityPercent},${t.activeOutageDurationMinutes},${exposureOf(t)}`),
      '',
      'SHIFT AUDIT LOG',
      'time,actor,action,detail',
      ...audit.map((a) => `${a.time},${a.actor},${a.action},"${a.detail.replace(/"/g, '""')}"`)
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `econet-evidence-pack-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl bg-[#0e2a47] text-white shadow-sm" aria-label="Executive posture">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#c9a227]" />
            <div>
              <h2 className="font-bold">Compliance posture — {posture === 'nominal' ? 'Nominal' : posture === 'watch' ? 'Watch' : 'Action required'}</h2>
              <p className="tnum text-xs text-blue-200">
                100 pilot sites · synced {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'} · SI 154
              </p>
            </div>
          </div>
          <button onClick={exportEvidence} className="flex items-center gap-1 rounded-lg bg-[#c9a227] px-3 py-1.5 text-sm font-bold text-[#0e2a47]">
            <FileDown size={14} /> Evidence pack
          </button>
        </div>
        <div className="tnum grid grid-cols-2 gap-2 p-4 pt-0 text-center sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-blue-200">Live exposure</p>
            <p className="text-xl font-bold">US${roi.unmitigatedExposuresUsd.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-blue-200">Shielded to date</p>
            <p className="text-xl font-bold text-emerald-300">US${roi.mitigatedSavingsUsd.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-blue-200">Offline sites</p>
            <p className="text-xl font-bold">{offline.length}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-blue-200">Care resolutions</p>
            <p className="text-xl font-bold">{resolutions}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Fleet status" subtitle="Live split across the 100 pilot sites">
          <Donut data={fleetStatusData(towers)} />
        </ChartCard>
        <ChartCard title="Cell availability bands" subtitle="Under 67% breaches the SI 154 floor">
          <BarList rows={caBands(towers)} bandColor={(v) => (v > 0 ? '#ef4444' : '#cbd5e1')} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="For the regulator">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-slate-800" />
            <h3 className="font-bold text-slate-900">For POTRAZ — what you can defend</h3>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {worst.map((t) => (
              <li key={t.id} className="tnum">
                <span className="font-semibold text-slate-900">{t.name} ({t.id})</span> — {t.status.toLowerCase()}, CA {t.cellAvailabilityPercent}%
                {t.activeOutageDurationMinutes > 0 && `, outage ${t.activeOutageDurationMinutes}m`}, crew {audit.some((a) => a.detail.includes(t.id)) ? 'assigned and logged' : 'unassigned'}.
              </li>
            ))}
            {worst.every((t) => exposureOf(t) === 0) && <li>Every site inside limits — the audit log below is your clean record.</li>}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Each line above traces to a timestamped entry in Reports → Shift audit log, exportable as the evidence pack.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="For customers">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-slate-800" />
            <h3 className="font-bold text-slate-900">For customers — what you can say</h3>
          </div>
          <p className="tnum mt-2 text-sm text-slate-700">
            {resolutions} subscriber {resolutions === 1 ? 'case' : 'cases'} resolved through proactive FUP alerts without a call-centre ticket this shift.
            Subscribers hitting 50 / 80 / 90 / 100% of their high-speed allowance are warned before throttling — no “vanishing data” surprises.
          </p>
          <p className="mt-2 text-xs text-slate-500">Suggested line: “Check your live usage in My-Data — we alert you at every threshold before speeds ever change.”</p>
        </section>
      </div>
    </div>
  );
}
