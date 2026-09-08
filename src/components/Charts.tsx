// Charts — lightweight, dependency-free SVG visualisations for the pilot.
// No charting library: keeps bundle small and mobile-friendly for low-cost
// Android hardware. All charts are read-only and carry aria-labels.
import type { ReactNode } from 'react';
import type { TowerTelemetry } from '../types';

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(cx, cy, r, endDeg);
  const [ex, ey] = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}`;
}

const PALETTE = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'];

// ---- Donut: share of a whole ----
export function Donut({
  data,
  size = 160,
  thickness = 22
}: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  let angle = 0;
  const segments = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const seg = { ...d, start: angle, end: angle + frac * 360, color: d.color || PALETTE[i % PALETTE.length] };
    angle += frac * 360;
    return seg;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Fleet status share" role="img">
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
        ) : (
          segments.map((s, i) =>
            s.value > 0 ? (
              <path
                key={i}
                d={arcPath(cx, cy, r, s.start, s.end)}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap="butt"
              />
            ) : null
          )
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" className="tnum" fontSize={26} fontWeight={700} fill="#0f172a">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="#64748b">
          sites
        </text>
      </svg>
      <ul className="space-y-1 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-slate-700">{s.label}</span>
            <span className="tnum ml-auto font-semibold text-slate-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Horizontal bars: fleet distribution across bands ----
export function BarList({
  rows,
  unit = '',
  bandColor
}: {
  rows: { label: string; value: number }[];
  unit?: string;
  bandColor?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2" role="img" aria-label="Distribution by band">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 text-slate-600">{r.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className="tnum flex h-full items-center justify-end rounded px-1.5 text-[11px] font-semibold text-white"
              style={{
                width: `${(r.value / max) * 100}%`,
                minWidth: r.value > 0 ? '1.5rem' : undefined,
                background: bandColor ? bandColor(r.value) : '#0e2a47'
              }}
            >
              {r.value}
              {unit}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Paired bars: exposure vs saved vs net (reports) ----
export function FinancialBars({ items }: { items: { label: string; value: number; note: string; color: string }[] }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className="space-y-3" role="img" aria-label="Financial summary bars">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-slate-800">{it.label}</span>
            <span className="tnum font-bold text-slate-900">US${it.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="mt-1 h-4 overflow-hidden rounded bg-slate-100">
            <div
              className="tnum flex h-full items-center justify-end rounded px-1.5 text-[11px] font-semibold text-white"
              style={{ width: `${Math.min(100, (Math.abs(it.value) / max) * 100)}%`, background: it.color }}
            >
              {Math.round((Math.abs(it.value) / max) * 100)}%
            </div>
          </div>
          <p className="tnum mt-0.5 text-[11px] text-slate-500">{it.note}</p>
        </div>
      ))}
    </div>
  );
}

// Card wrapper used by the overview/executive panels.
export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={title}>
      <h3 className="font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Shared derived data helpers -------------------------------------------------

export function fleetStatusData(towers: TowerTelemetry[]) {
  return [
    { label: 'Online', value: towers.filter((t) => t.status === 'Online').length, color: '#22c55e' },
    { label: 'Backup battery', value: towers.filter((t) => t.status === 'Backup Battery').length, color: '#f59e0b' },
    { label: 'Offline', value: towers.filter((t) => t.status === 'Offline').length, color: '#ef4444' }
  ];
}

export function caBands(towers: TowerTelemetry[]) {
  const bands = [
    { label: '<50%', value: 0 },
    { label: '50–66%', value: 0 },
    { label: '67–79%', value: 0 },
    { label: '80–89%', value: 0 },
    { label: '90–100%', value: 0 }
  ];
  for (const t of towers) {
    const ca = t.cellAvailabilityPercent;
    if (ca < 50) bands[0].value += 1;
    else if (ca < 67) bands[1].value += 1;
    else if (ca < 80) bands[2].value += 1;
    else if (ca < 90) bands[3].value += 1;
    else bands[4].value += 1;
  }
  return bands;
}
