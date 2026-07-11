'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusChip } from '@/components/ui/StatusChip'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { formatUah } from '@/domain/money'
import { useMonth, MonthPicker } from '@/lib/period'

interface DebtRow { leaseId: string; tenantName: string; premisesLabel: string; invoicedKop: number; paidKop: number; debtKop: number; advanceKop: number }
interface MonthlyRow { leaseId: string; tenantName: string; premisesLabel: string; totalKop: number; status: 'UNPAID' | 'PARTIAL' | 'PAID' }
type Tab = 'debts' | 'monthly'
const now = new Date()

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('debts')
  const { year, month, setYear, setMonth } = useMonth(now.getUTCFullYear(), now.getUTCMonth() + 1)
  const debts = useQuery({ queryKey: ['rep-debts'], queryFn: () => apiFetch<DebtRow[]>('/api/reports/debts'), enabled: tab === 'debts' })
  const monthly = useQuery({ queryKey: ['rep-monthly', year, month], queryFn: () => apiFetch<{ rows: MonthlyRow[]; totalInvoicedKop: number }>(`/api/reports/monthly?year=${year}&month=${month}`), enabled: tab === 'monthly' })

  const debtCols: Column<DebtRow & { id: string }>[] = [
    { key: 'tenantName', header: 'Орендар', render: (r) => <span className="text-primary font-bold">{r.tenantName}</span> },
    { key: 'premisesLabel', header: 'Приміщення', render: (r) => r.premisesLabel },
    { key: 'invoicedKop', header: 'Нараховано', render: (r) => formatUah(r.invoicedKop) },
    { key: 'paidKop', header: 'Оплачено', render: (r) => formatUah(r.paidKop) },
    { key: 'debtKop', header: 'Борг', render: (r) => <span className="font-bold text-error">{formatUah(r.debtKop)}</span> },
    { key: 'advanceKop', header: 'Аванс', render: (r) => formatUah(r.advanceKop) },
  ]
  const monthlyCols: Column<MonthlyRow & { id: string }>[] = [
    { key: 'tenantName', header: 'Орендар', render: (r) => <span className="text-primary font-bold">{r.tenantName}</span> },
    { key: 'premisesLabel', header: 'Приміщення', render: (r) => r.premisesLabel },
    { key: 'totalKop', header: 'Сума', render: (r) => formatUah(r.totalKop) },
    { key: 'status', header: 'Статус', render: (r) => <StatusChip status={r.status} /> },
  ]
  const withId = <T extends { leaseId: string }>(rows: T[]) => rows.map((r, i) => ({ ...r, id: `${r.leaseId}-${i}` }))
  const exportHref = tab === 'debts' ? '/api/reports/export?type=debts' : `/api/reports/export?type=monthly&year=${year}&month=${month}`

  return (
    <>
      <PageHeader title="Звіти" action={<a href={exportHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-body-md border-2 border-primary text-primary hover:bg-primary hover:text-on-primary transition-all"><Icon name="download" />Експорт CSV</a>} />
      <div className="flex gap-2 mb-stack-md">
        <Button variant={tab === 'debts' ? 'navy' : 'ghost'} onClick={() => setTab('debts')}>Борги</Button>
        <Button variant={tab === 'monthly' ? 'navy' : 'ghost'} onClick={() => setTab('monthly')}>Місячний</Button>
        {tab === 'monthly' && <MonthPicker year={year} month={month} setYear={setYear} setMonth={setMonth} />}
      </div>
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container">
        {tab === 'debts' && <DataTable columns={debtCols} rows={withId(debts.data ?? [])} empty="Боргів немає" />}
        {tab === 'monthly' && <DataTable columns={monthlyCols} rows={withId(monthly.data?.rows ?? [])} empty="Нарахувань за місяць немає" />}
      </div>
    </>
  )
}
