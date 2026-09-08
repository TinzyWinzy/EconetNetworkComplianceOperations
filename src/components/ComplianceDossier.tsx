import { useState } from 'react';
import { FileDown, FileText, ShieldCheck } from 'lucide-react';
import type { AuditEntry, TowerTelemetry } from '../types';

/**
 * POTRAZ Compliance Dossier export — the tangible filing Fungai can hand over.
 * PDF + CSV are generated lazily (pdf-lib is dynamically imported) so the
 * heavy dependency never lands in the initial bundle.
 */
export default function ComplianceDossier({
  towers,
  audit,
  resolutions,
  module1,
  module2
}: {
  towers: TowerTelemetry[];
  audit: AuditEntry[];
  resolutions: number;
  module1: boolean;
  module2: boolean;
}) {
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const input = () => ({ towers, audit, resolutions, generatedAt: new Date(), module1, module2 });

  const download = (blob: Blob, filename: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportPdf = async () => {
    setBusy('pdf');
    setError(null);
    try {
      const { buildDossierPdf } = await import('../lib/dossier');
      const bytes = await buildDossierPdf(input());
      download(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), `potraz-compliance-dossier-${stamp()}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy('csv');
    setError(null);
    try {
      const { buildDossierCsv } = await import('../lib/dossier');
      const csv = buildDossierCsv(input());
      download(new Blob([csv], { type: 'text/csv' }), `potraz-qos-schedule-${stamp()}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSV export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="POTRAZ compliance dossier">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-[#0e2a47]" />
        <div>
          <h2 className="font-bold text-slate-900">POTRAZ Compliance Dossier</h2>
          <p className="text-xs text-slate-500">Formal SI 154 quarterly filing — generated-at statutory timestamp, QoS schedule, breach summary and audit ledger.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={exportPdf}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg bg-[#0e2a47] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <FileDown size={15} /> {busy === 'pdf' ? 'Building PDF…' : 'Export PDF dossier'}
        </button>
        <button
          onClick={exportCsv}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <FileText size={15} /> {busy === 'csv' ? 'Building CSV…' : 'Export CSV schedule'}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}

      <p className="tnum mt-3 text-[11px] text-slate-500">
        Cover: statutory targets + fine structure · landscape QoS schedule ({towers.length} sites) · breach summary · sign-off block.
        All figures are labelled synthetic pilot data — not an official filing.
      </p>
    </section>
  );
}
