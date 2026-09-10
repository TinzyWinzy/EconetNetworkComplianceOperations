// dossier.ts — Formal POTRAZ QoS Compliance Dossier generation (PDF + CSV).
// PDF via pdf-lib (loaded lazily by the component); CSV is a plain string.
// All figures are SYNTHETIC pilot data and are labelled as such inside the document.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { AuditEntry, TowerTelemetry } from '../types';
import { SI_LIMITS } from '../types';
import { exposureOf } from './exposure';

export interface DossierInput {
  towers: TowerTelemetry[];
  audit: AuditEntry[];
  resolutions: number;
  generatedAt: Date;
  module1: boolean;
  module2: boolean;
}

const NAVY = rgb(0.176, 0.208, 0.545); // #2d358b Econet indigo
const GOLD = rgb(0.914, 0.133, 0.184); // #e9222f Econet red accent
const INK = rgb(0.1, 0.12, 0.14);
const MUTED = rgb(0.42, 0.47, 0.53);
const GREEN = rgb(0.13, 0.55, 0.13);
const RED = rgb(0.72, 0.15, 0.15);
const AMBER = rgb(0.72, 0.5, 0.05);
const LINE = rgb(0.85, 0.88, 0.9);

/**
 * Strip / replace any character that falls outside WinAnsi (Windows-1252).
 * pdf-lib's StandardFonts are WinAnsi-encoded — anything above 0xFF throws.
 * We map common Unicode glyphs to readable ASCII equivalents first, then drop
 * anything still outside the safe range.
 */
function sanitise(text: string): string {
  return text
    // arrows
    .replace(/\u2192/g, '->')   // → (the one that triggered the bug)
    .replace(/\u2190/g, '<-')   // ←
    .replace(/\u2194/g, '<->') // ↔
    .replace(/\u21d2/g, '=>')  // ⇒
    // dashes & spaces
    .replace(/\u2014/g, '--')   // em dash —
    .replace(/\u2013/g, '-')    // en dash –
    .replace(/\u00b7/g, '.')    // middle dot ·
    .replace(/\u2022/g, '*')    // bullet •
    // quotes
    .replace(/[\u2018\u2019]/g, "'")  // curly single quotes
    .replace(/[\u201c\u201d]/g, '"')  // curly double quotes
    // ellipsis
    .replace(/\u2026/g, '...')  // …
    // drop anything still outside Latin-1 / WinAnsi
    .replace(/[^\x00-\xFF]/g, '?');
}

function usd(n: number): string {
  return `US$${Math.round(n).toLocaleString('en-US')}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function statusColor(t: TowerTelemetry) {
  return t.status === 'Offline' || t.cellAvailabilityPercent < SI_LIMITS.cellAvailability ? RED : t.status === 'Backup Battery' ? AMBER : GREEN;
}

function breaches(t: TowerTelemetry): string[] {
  const out: string[] = [];
  if (t.cellAvailabilityPercent < SI_LIMITS.cellAvailability) out.push('CA');
  if (t.dsasrPercent < SI_LIMITS.dsasr) out.push('DSASR');
  if (t.dsdrPercent > SI_LIMITS.dsdr) out.push('DSDR');
  return out;
}

function escapeCsv(cell: string | number): string {
  return `"${String(cell).replace(/"/g, '""')}"`;
}

/** Formal tower-level QoS schedule (single clean table for filing). */
export function buildDossierCsv(input: DossierInput): string {
  const header = [
    'tower_id', 'site', 'region', 'latitude', 'longitude', 'status',
    'cell_availability_pct', 'dsasr_pct', 'dsdr_pct', 'dropped_call_rate_pct',
    'outage_min', 'exposure_usd', 'breaches'
  ];
  const rows = input.towers.map((t) => [
    t.id,
    t.name,
    t.region,
    t.latitude.toFixed(6),
    t.longitude.toFixed(6),
    t.status,
    t.cellAvailabilityPercent.toFixed(2),
    t.dsasrPercent.toFixed(2),
    t.dsdrPercent.toFixed(2),
    t.droppedCallRatePercent.toFixed(2),
    t.activeOutageDurationMinutes,
    exposureOf(t),
    breaches(t).join(';') || 'NONE'
  ].map((c) => escapeCsv(c)));
  return [header.map((h) => escapeCsv(h)).join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function wrapWithMeasure(text: string, size: number, measure: (s: string) => number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/** Multi-page PDF dossier. Cover (portrait) + schedule (landscape) + summary (portrait). */
export async function buildDossierPdf(input: DossierInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const A4_P = { w: 595.28, h: 841.89 };
  const A4_L = { w: 841.89, h: 595.28 };
  const margin = 48;
  const top = A4_P.h - margin;
  const bottom = margin;
  const contentW = A4_P.w - margin * 2;

  const openCases = input.towers.filter((t) => exposureOf(t) > 0);
  const offline = input.towers.filter((t) => t.status === 'Offline');
  const totalExposure = input.towers.reduce((s, t) => s + exposureOf(t), 0);
  const generated = input.generatedAt.toISOString();

  // ---------- Cover page ----------
  let page = doc.addPage([A4_P.w, A4_P.h]);
  let y = top;

  page.drawRectangle({ x: 0, y: A4_P.h - 8, width: A4_P.w, height: 8, color: NAVY });
  page.drawText('POTRAZ QOS COMPLIANCE DOSSIER', { x: margin, y: top - 24, size: 22, font: bold, color: NAVY });
  page.drawText('Statutory Instrument 154 of 2024 — Quarterly QoS Filing', { x: margin, y: top - 44, size: 11, font, color: GOLD });

  y = top - 80;
  page.drawText('ECONET WIRELESS ZIMBABWE', { x: margin, y, size: 14, font: bold, color: INK }); y -= 18;
  page.drawText('Harare Regional Pilot — 100 sites', { x: margin, y, size: 11, font, color: INK }); y -= 16;
  page.drawText(`Generated at: ${generated}`, { x: margin, y, size: 10, font, color: MUTED }); y -= 14;
  page.drawText('Prepared by: RadBit Studios — Customer Trust & Regulatory Compliance Suite', { x: margin, y, size: 10, font, color: MUTED }); y -= 28;

  page.drawText('STATUTORY TARGETS (SI 154 OF 2024)', { x: margin, y, size: 11, font: bold, color: NAVY }); y -= 16;
  const targets = [
    ['Cell Availability (CA)', `>= ${SI_LIMITS.cellAvailability}%`],
    ['Data Service Access Success Rate (DSASR)', `>= ${SI_LIMITS.dsasr}%`],
    ['Data Service Drop Rate (DSDR)', `<= ${SI_LIMITS.dsdr}%`],
    ['Penalty-free outage window', `${SI_LIMITS.outageFreeMinutes / 60} hours`]
  ];
  for (const [k, v] of targets) {
    page.drawText(`•  ${k}`, { x: margin, y, size: 9.5, font, color: INK });
    page.drawText(v, { x: margin + 300, y, size: 9.5, font: bold, color: INK });
    y -= 14;
  }
  y -= 10;

  page.drawText('FINE STRUCTURE', { x: margin, y, size: 11, font: bold, color: NAVY }); y -= 16;
  const fines = [
    `Outage: ${usd(SI_LIMITS.baseFineUsd)} flat + ${usd(SI_LIMITS.hourlyFineUsd)}/hr after ${SI_LIMITS.outageFreeMinutes / 60} hrs`,
    `Tower-level breach: ${usd(SI_LIMITS.towerFineUsd)} per tower per month`,
    `24-hour outage cap: ${usd(SI_LIMITS.dayCapUsd)}`,
    'Reporting failure: up to US$5,000 per month'
  ];
  for (const f of fines) {
    page.drawText(`•  ${f}`, { x: margin, y, size: 9.5, font, color: INK });
    y -= 14;
  }
  y -= 10;

  page.drawText('PILOT SUMMARY', { x: margin, y, size: 11, font: bold, color: NAVY }); y -= 16;
  page.drawText(`Live fine exposure: ${usd(totalExposure)}`, { x: margin, y, size: 10, font: bold, color: RED }); y -= 14;
  page.drawText(`Sites in breach: ${openCases.length}`, { x: margin, y, size: 10, font, color: INK }); y -= 14;
  page.drawText(`Offline sites: ${offline.length}`, { x: margin, y, size: 10, font, color: INK }); y -= 14;
  page.drawText(`Care resolutions (FUP deflection): ${input.resolutions}`, { x: margin, y, size: 10, font, color: INK }); y -= 14;
  page.drawText(`Modules active — QoS shield: ${input.module1 ? 'ON' : 'OFF'} · Care deflection: ${input.module2 ? 'ON' : 'OFF'}`, { x: margin, y, size: 10, font, color: INK }); y -= 28;

  page.drawLine({ start: { x: margin, y }, end: { x: A4_P.w - margin, y }, thickness: 1, color: LINE });
  y -= 16;
  const disclaimer = 'DISCLAIMER: This dossier contains SYNTHETIC PILOT DATA for demonstration of the RadBit compliance sidecar. It is not an official Econet filing and must not be submitted to POTRAZ until validated against live NOC and call-centre records.';
  for (const l of wrapWithMeasure(disclaimer, 8, (s) => font.widthOfTextAtSize(s, 8), contentW)) {
    page.drawText(l, { x: margin, y, size: 8, font, color: MUTED });
    y -= 11;
  }

  // ---------- Schedule pages (landscape) ----------
  const schedCols: { key: string; label: string; w: number; right?: boolean }[] = [
    { key: 'id', label: 'ID', w: 34 },
    { key: 'name', label: 'Site', w: 168 },
    { key: 'region', label: 'Region', w: 66 },
    { key: 'status', label: 'Status', w: 72 },
    { key: 'ca', label: 'CA%', w: 44, right: true },
    { key: 'dsasr', label: 'DSASR%', w: 52, right: true },
    { key: 'dsdr', label: 'DSDR%', w: 50, right: true },
    { key: 'dcr', label: 'DCR%', w: 44, right: true },
    { key: 'outage', label: 'Outage m', w: 60, right: true },
    { key: 'exposure', label: 'US$', w: 64, right: true }
  ];
  const schedX = margin;
  const schedW = A4_L.w - margin * 2;

  const newSchedPage = () => {
    const p = doc.addPage([A4_L.w, A4_L.h]);
    const yy = A4_L.h - margin;
    p.drawText('QoS TOWER SCHEDULE — Harare Regional Pilot', { x: schedX, y: yy, size: 11, font: bold, color: NAVY });
    p.drawText(`Generated at: ${generated}`, { x: A4_L.w - margin - 180, y: yy, size: 7, font, color: MUTED });
    let cx = schedX;
    const hy = yy - 14;
    for (const c of schedCols) {
      p.drawText(c.label, { x: cx, y: hy, size: 7, font: bold, color: INK });
      cx += c.w;
    }
    p.drawLine({ start: { x: schedX, y: hy - 3 }, end: { x: schedX + schedW, y: hy - 3 }, thickness: 0.6, color: LINE });
    return { p, y: hy - 11 };
  };

  let s = newSchedPage();
  let schedPage = s.p;
  let sy = s.y;

  const emitRow = (t: TowerTelemetry) => {
    if (sy < margin + 8) {
      const n = newSchedPage();
      schedPage = n.p;
      sy = n.y;
    }
    const cells: Record<string, string> = {
      id: sanitise(t.id),
      name: sanitise(t.name.length > 34 ? t.name.slice(0, 33) + '...' : t.name),
      region: sanitise(t.region),
      status: sanitise(t.status),
      ca: pct(t.cellAvailabilityPercent),
      dsasr: pct(t.dsasrPercent),
      dsdr: pct(t.dsdrPercent),
      dcr: pct(t.droppedCallRatePercent),
      outage: t.activeOutageDurationMinutes > 0 ? String(t.activeOutageDurationMinutes) : '-',
      exposure: exposureOf(t) > 0 ? usd(exposureOf(t)) : '-'
    };
    let cx = schedX;
    const col = statusColor(t);
    for (const c of schedCols) {
      const text = cells[c.key];
      const x = c.right ? cx + c.w - 4 - font.widthOfTextAtSize(text, 7) : cx;
      const color = c.key === 'exposure' && exposureOf(t) > 0 ? RED : c.key === 'status' ? col : INK;
      schedPage.drawText(text, { x, y: sy, size: 7, font, color });
      cx += c.w;
    }
    sy -= 9.5;
  };

  for (const t of input.towers) emitRow(t);

  // ---------- Summary page (portrait) ----------
  page = doc.addPage([A4_P.w, A4_P.h]);
  y = top;
  page.drawText('BREACH SUMMARY', { x: margin, y, size: 12, font: bold, color: NAVY }); y -= 18;
  const worst = [...openCases].sort((a, b) => exposureOf(b) - exposureOf(a)).slice(0, 15);
  if (worst.length === 0) {
    page.drawText('No sites in breach. All towers inside SI 154 statutory limits.', { x: margin, y, size: 10, font, color: GREEN });
    y -= 16;
  } else {
    for (const t of worst) {
      page.drawText(`${t.id}  ${t.name}`, { x: margin, y, size: 9, font: bold, color: INK });
      page.drawText(`${t.status} · CA ${pct(t.cellAvailabilityPercent)} · DSASR ${pct(t.dsasrPercent)} · DSDR ${pct(t.dsdrPercent)}`, { x: margin + 220, y, size: 8.5, font, color: INK });
      page.drawText(exposureOf(t) > 0 ? usd(exposureOf(t)) : '—', { x: A4_P.w - margin - 80, y, size: 9, font: bold, color: RED });
      y -= 14;
    }
  }
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: A4_P.w - margin, y }, thickness: 0.6, color: LINE });
  y -= 18;

  page.drawText('SHIFT AUDIT LEDGER', { x: margin, y, size: 12, font: bold, color: NAVY }); y -= 16;
  if (input.audit.length === 0) {
    page.drawText('No operational actions logged this shift.', { x: margin, y, size: 9.5, font, color: MUTED });
    y -= 14;
  } else {
    for (const a of input.audit.slice(0, 20)) {
      const when = new Date(a.time).toLocaleString();
      const line = sanitise(`${when}  |  ${a.actor}  -  ${a.action}: ${a.detail}`);
      for (const l of wrapWithMeasure(line, 8, (s) => font.widthOfTextAtSize(s, 8), contentW)) {
        if (y < bottom) break;
        page.drawText(l, { x: margin, y, size: 8, font, color: INK });
        y -= 11;
      }
    }
  }
  y -= 20;

  page.drawLine({ start: { x: margin, y }, end: { x: A4_P.w - margin, y }, thickness: 0.6, color: LINE });
  y -= 20;
  page.drawText('SIGN-OFF', { x: margin, y, size: 11, font: bold, color: NAVY }); y -= 16;
  page.drawText('Compliance Officer: ____________________________    Date: ______________', { x: margin, y, size: 9.5, font, color: INK }); y -= 22;
  const disp2 = 'SYNTHETIC PILOT DATA — NOT AN OFFICIAL ECONET FILING. Validate against live NOC and call-centre records before submission to POTRAZ.';
  for (const l of wrapWithMeasure(disp2, 8, (s) => font.widthOfTextAtSize(s, 8), contentW)) {
    page.drawText(l, { x: margin, y, size: 8, font, color: RED });
    y -= 11;
  }

  return doc.save();
}
