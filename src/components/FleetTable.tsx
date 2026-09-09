import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState
} from '@tanstack/react-table';
import { ArrowUpDown, Search } from 'lucide-react';
import type { CrewAssignment, TowerTelemetry } from '../types';
import { exposureOf } from '../lib/exposure';

const col = createColumnHelper<TowerTelemetry>();

function statusBadge(t: TowerTelemetry) {
  const breach = exposureOf(t) > 0;
  const cls = breach || t.status === 'Offline'
    ? 'bg-red-50 text-red-800 border-red-200'
    : t.status === 'Backup Battery'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-emerald-50 text-emerald-800 border-emerald-200';
  const label = breach && t.status !== 'Offline' ? `${t.status} · breach` : t.status;
  return <span className={`tnum rounded border px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

/** Sortable, searchable tower table (TanStack Table — headless, no styling cost). */
export default function FleetTable({
  towers,
  assignments,
  onAssign,
  readOnly = false
}: {
  towers: TowerTelemetry[];
  assignments: Map<string, CrewAssignment>;
  onAssign: (id: string) => void;
  readOnly?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'exposure', desc: true }]);
  const [filter, setFilter] = useState('');

  const columns = useMemo(
    () => [
      col.accessor('id', { header: 'ID', cell: (i) => <span className="tnum font-semibold text-slate-700">{i.getValue()}</span>, meta: { sticky: true } }),      col.accessor('name', { header: 'Site', cell: (i) => <span className="truncate">{i.getValue()}</span> }),
      col.accessor('region', { header: 'Region' }),
      col.accessor('status', { header: 'Status', cell: (i) => statusBadge(i.row.original), enableSorting: false }),
      col.accessor('cellAvailabilityPercent', { header: 'CA%', cell: (i) => <span className="tnum">{i.getValue().toFixed(1)}</span> }),
      col.accessor('dsasrPercent', { header: 'DSASR%', cell: (i) => <span className="tnum">{i.getValue().toFixed(1)}</span> }),
      col.accessor('dsdrPercent', { header: 'DSDR%', cell: (i) => <span className="tnum">{i.getValue().toFixed(1)}</span> }),
      col.accessor('activeOutageDurationMinutes', {
        header: 'Outage',
        cell: (i) => <span className="tnum">{i.getValue() > 0 ? `${i.getValue()}m` : '—'}</span>
      }),
      col.accessor((row) => exposureOf(row), {
        id: 'exposure',
        header: 'Exposure',
        cell: (i) => {
          const v = i.getValue();
          return <span className={`tnum font-semibold ${v > 0 ? 'text-red-700' : 'text-slate-400'}`}>{v > 0 ? `US$${v.toLocaleString()}` : '—'}</span>;
        }
      }),
      col.display({
        id: 'action',
        header: '',
        cell: (i) => {
          const t = i.row.original;
          const assigned = assignments.get(t.id);
          if (assigned) return <span className="tnum text-xs font-semibold text-blue-800">{assigned.crew}</span>;
          if (readOnly) return <span className="text-xs text-slate-400">NOC pending</span>;
          return (
            <button onClick={() => onAssign(t.id)} className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700">
              Assign
            </button>
          );
        }
      })
    ],
    [assignments, onAssign, readOnly]
  );

  const data = useMemo(() => towers, [towers]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _colId, value) => {
      const q = String(value).toLowerCase();
      const r = row.original;
      return `${r.id} ${r.name} ${r.region} ${r.status}`.toLowerCase().includes(q);
    }
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Tower fleet table">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900">Tower fleet · <span className="tnum">{table.getFilteredRowModel().rows.length}/{towers.length}</span> sites</h2>
        <label className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search site, ID or region"
            className="rounded-lg border border-slate-300 py-1.5 pl-7 pr-2 text-sm"
            aria-label="Search fleet table"
          />
        </label>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-200">
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-slate-900"
                        aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown size={12} />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={`px-2 py-2 text-slate-700 ${cell.column.id === 'id' ? 'sticky left-0 bg-white shadow-[1px_0_0_#e2e8f0]' : ''}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-2 py-6 text-center text-sm text-slate-400">No sites match this search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="tnum mt-2 text-xs text-slate-500">Click a column header to sort. Exposure sorts highest-first by default.</p>
    </section>
  );
}
