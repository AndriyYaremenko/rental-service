import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

function cell<T>(c: Column<T>, row: T): ReactNode {
  return c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')
}

export function DataTable<T extends { id?: string }>({ columns, rows, empty = 'Немає даних' }: { columns: Column<T>[]; rows: T[]; empty?: string }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-on-surface-variant text-body-md">{empty}</p>
  }
  return (
    <>
      {/* Десктоп: таблиця */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="text-on-surface-variant border-b border-surface-container">
              {columns.map((c) => (
                <th key={c.key} className={`py-3 text-label-md uppercase tracking-wider ${c.className ?? ''}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {rows.map((row, i) => (
              <tr key={row.id ?? i} className="hover:bg-surface-container-low transition-colors">
                {columns.map((c) => (
                  <td key={c.key} className={`py-4 text-body-md ${c.className ?? ''}`}>{cell(c, row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Мобільний: картки */}
      <div className="md:hidden space-y-2.5">
        {rows.map((row, i) => (
          <div key={row.id ?? i} className="rounded-lg border border-surface-container bg-surface-container-low p-3 divide-y divide-surface-container">
            {columns.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                {c.header
                  ? <><span className="text-label-md uppercase tracking-wider text-on-surface-variant shrink-0">{c.header}</span><span className="text-body-md text-right">{cell(c, row)}</span></>
                  : <span className="w-full flex justify-end">{cell(c, row)}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
