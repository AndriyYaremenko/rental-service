import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

export function DataTable<T extends { id?: string }>({ columns, rows, empty = 'Немає даних' }: { columns: Column<T>[]; rows: T[]; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-on-surface-variant border-b border-surface-container">
            {columns.map((c) => (
              <th key={c.key} className={`py-3 text-label-md uppercase tracking-wider ${c.className ?? ''}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-8 text-center text-on-surface-variant text-body-md">{empty}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={row.id ?? i} className="hover:bg-surface-container-low transition-colors">
              {columns.map((c) => (
                <td key={c.key} className={`py-4 text-body-md ${c.className ?? ''}`}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
