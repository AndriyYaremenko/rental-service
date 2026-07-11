'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { errorMessage } from '@/lib/forms'
import { PageHeader } from '@/components/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusChip } from '@/components/ui/StatusChip'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { formatUah } from '@/domain/money'
import { useMonth, MonthPicker } from '@/lib/period'
import { InvoiceDetail } from './InvoiceDetail'

interface InvoiceDTO { id: string; leaseId: string; totalKop: number; status: 'UNPAID' | 'PARTIAL' | 'PAID' }
const now = new Date()
export default function InvoicesPage() {
  const qc = useQueryClient()
  const { year, month, setYear, setMonth } = useMonth(now.getUTCFullYear(), now.getUTCMonth() + 1)
  const list = useQuery({ queryKey: ['invoices', year, month], queryFn: () => apiFetch<InvoiceDTO[]>(`/api/invoices?year=${year}&month=${month}`) })
  const [detail, setDetail] = useState<string | null>(null)
  const gen = useMutation({
    mutationFn: () => apiFetch<{ created: number; skipped: { leaseId: string; reason: string }[] }>('/api/invoices/generate', { method: 'POST', body: JSON.stringify({ year, month }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices', year, month] }),
  })
  const cols: Column<InvoiceDTO>[] = [
    { key: 'leaseId', header: 'Договір', render: (i) => <span className="text-primary font-bold">{i.leaseId.slice(0, 8)}</span> },
    { key: 'totalKop', header: 'Сума', render: (i) => formatUah(i.totalKop) },
    { key: 'status', header: 'Статус', render: (i) => <StatusChip status={i.status} /> },
    { key: 'actions', header: '', className: 'text-right', render: (i) => <button onClick={() => setDetail(i.id)} className="text-on-surface-variant hover:text-primary" aria-label="Деталь"><Icon name="visibility" /></button> },
  ]
  return (
    <>
      <PageHeader title="Нарахування" action={<span className="inline-flex items-center gap-3"><MonthPicker year={year} month={month} setYear={setYear} setMonth={setMonth} /><Button variant="navy" onClick={() => gen.mutate()} disabled={gen.isPending}>{gen.isPending ? 'Формування…' : 'Сформувати нарахування'}</Button></span>} />
      {gen.isError && <p className="text-error text-body-md mb-4">{errorMessage(gen.error)}</p>}
      {gen.isSuccess && <p className="text-secondary text-body-md mb-4">Сформовано: {gen.data.created}. Пропущено: {gen.data.skipped.length}.</p>}
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container">
        {list.isLoading ? <p className="text-on-surface-variant">Завантаження…</p> : <DataTable columns={cols} rows={list.data ?? []} empty="Нарахувань за місяць немає" />}
      </div>
      {detail && <InvoiceDetail id={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
