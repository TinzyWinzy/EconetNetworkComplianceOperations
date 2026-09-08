import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import type { AuditEntry } from '../types';

const col = createColumnHelper<AuditEntry>();

/** Sortable, append-only audit ledger (TanStack Table). */
export default function AuditLogTable({ audit }: { audit: AuditEntry[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'time', desc: true }]);

  const columns = useMemo(
    () => [
      col.accessor('time', {
        header: 'Time',
        cell: (i) => <span className="tnum whitespace-nowrap text-slate-500">{new Date(i.getValue()).toLocaleTimeString()}</span>
      }),
      col.accessor('actor', { header: 'Actor', cell: (i) => <span className="font-semibold text-slate-800">{i.getValue()}</span> }),
      col.accessor('action', { header: 'Action' }),
      col.accessor('detail', { header: 'Detail', cell: (i) => <span className="text-slate-600">{i.getValue()}</span> })
    ],
    []
  );

  const table = useReactTable({
    data: audit,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-slate-200">
              {hg.headers.map((header) => (
                <th key={header.id} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {header.column.getCanSort() ? (
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
            <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-2 py-1.5 text-slate-700">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
