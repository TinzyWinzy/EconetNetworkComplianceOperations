import { FileDown, Printer } from 'lucide-react';
import { FinancialROIState, TowerTelemetry } from '../types';
import { exposureOf } from '../lib/exposure';
import { FinancialBars } from './Charts';

/** Compliance report: exposure, savings, payback — exportable for POTRAZ filings. */
export default function ComplianceValue({
  roi,
  towers,
  resolutions,
  module1,
  module2
}: {
  roi: FinancialROIState;
  towers: TowerTelemetry[];
  resolutions: number;
  module1: boolean;
  module2: boolean;
}) {
  const LABOR = 2000;
  const sessionExtra = module2 ? resolutions * 10 : 0;
  const totalM = roi.mitigatedSavingsUsd + roi.supportDeflectionSavingsUsd + LABOR + sessionExtra;
  const net = totalM * 12 - 15000;
  const paybackD = totalM > 0 ? (15000 / totalM) * 30 : 365;

  const bars = [
    { label: 'Unmitigated exposure', value: roi.unmitigatedExposuresUsd, note: 'SI 154 outage + tower fines still at risk this pilot month', color: '#ef4444' },
    { label: 'Shielded by QoS shield', value: roi.mitigatedSavingsUsd, note: 'Outage + tower fines avoided via live shielding (75% efficiency)', color: '#22c55e' },
    { label: 'Support deflection savings', value: roi.supportDeflectionSavingsUsd + LABOR + sessionExtra, note: 'Call-centre deflection + labour avoided', color: '#3b82f6' },
    { label: 'Year-1 net value', value: net, note: `Annualised value minus US$15,000 capex · payback ${paybackD.toFixed(0)} days`, color: '#c9a227' }
  ];

  const exportCsv = () => {
    const rows = [
      ['tower_id', 'site', 'status', 'ca_pct', 'dsasr_pct', 'dsdr_pct', 'outage_min', 'exposure_usd'],
      ...towers.map((t) => [t.id, t.name, t.status, t.cellAvailabilityPercent, t.dsasrPercent, t.dsdrPercent, t.activeOutageDurationMinutes, exposureOf(t)])
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `potraz-fleet-exposure-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="rounded-2xl bg-[#0e2a47] p-4 text-white shadow-sm" aria-label="Compliance value report">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Compliance value · pilot month</h2>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1 rounded-lg bg-[#c9a227] px-3 py-1.5 text-sm font-bold text-[#0e2a47]">
            <FileDown size={14} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1 rounded-lg border border-white/30 px-3 py-1.5 text-sm">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>
      <div className="tnum mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <div className="rounded-xl bg-white/10 p-3">
          <p className="text-[11px] uppercase tracking-wide text-blue-200">Exposure</p>
          <p className="text-xl font-bold">US${roi.unmitigatedExposuresUsd.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <p className="text-[11px] uppercase tracking-wide text-blue-200">Shielded</p>
          <p className="text-xl font-bold text-emerald-300">US${roi.mitigatedSavingsUsd.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <p className="text-[11px] uppercase tracking-wide text-blue-200">Year-1 net</p>
          <p className="text-xl font-bold">US${net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <p className="text-[11px] uppercase tracking-wide text-blue-200">Payback</p>
          <p className="text-xl font-bold">{paybackD.toFixed(0)} days</p>
        </div>
      </div>
      <p className="tnum mt-2 text-xs text-blue-200">
        M1 shield {module1 ? 'active (75%)' : 'paused'} · M2 deflection {module2 ? `active · ${resolutions} assisted resolutions (+US$${sessionExtra.toLocaleString()})` : 'paused'} · reporting labour US$2,000/mo · capex US$15,000.
      </p>
      <div className="mt-4 rounded-xl bg-white/10 p-4">
        <h3 className="font-bold text-white">Value picture</h3>
        <FinancialBars items={bars} />
      </div>
    </section>
  );
}
