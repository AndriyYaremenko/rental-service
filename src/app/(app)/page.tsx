'use client'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { KpiCard } from '@/components/ui/KpiCard'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatUah } from '@/domain/money'

interface TenantDTO { id: string }
interface PremisesDTO { id: string; occupied: boolean }
interface InvoiceDTO { id: string; leaseId: string; totalKop: number; status: 'UNPAID' | 'PARTIAL' | 'PAID' }

const now = new Date()
const Y = now.getUTCFullYear(), M = now.getUTCMonth() + 1

export default function DashboardPage() {
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: () => apiFetch<TenantDTO[]>('/api/tenants') })
  const premises = useQuery({ queryKey: ['premises'], queryFn: () => apiFetch<PremisesDTO[]>('/api/premises') })
  const invoices = useQuery({ queryKey: ['invoices', Y, M], queryFn: () => apiFetch<InvoiceDTO[]>(`/api/invoices?year=${Y}&month=${M}`) })

  const tenantCount = tenants.data?.length ?? 0
  const occ = premises.data ? Math.round((premises.data.filter((p) => p.occupied).length / Math.max(premises.data.length, 1)) * 100) : 0
  const monthTotalKop = invoices.data?.reduce((s, i) => s + i.totalKop, 0) ?? 0

  const cols: Column<InvoiceDTO>[] = [
    { key: 'leaseId', header: 'Договір', render: (r) => <span className="text-primary font-bold">{r.leaseId.slice(0, 8)}</span> },
    { key: 'totalKop', header: 'Сума', render: (r) => formatUah(r.totalKop) },
    { key: 'status', header: 'Статус', render: (r) => <StatusChip status={r.status} /> },
  ]

  return (
    <div className="space-y-stack-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <KpiCard label="Орендарі" value={String(tenantCount)} icon="groups" iconTone="primary" />
        <KpiCard label="Заповненість" value={`${occ}%`} icon="home_work" iconTone="secondary" />
        <KpiCard label="Нараховано за місяць" value={formatUah(monthTotalKop)} icon="payments" iconTone="primary" />
      </div>
      <Card>
        <h3 className="text-headline-sm text-primary mb-6">Нарахування цього місяця</h3>
        <DataTable columns={cols} rows={invoices.data ?? []} empty="Нарахувань за місяць ще немає" />
      </Card>
    </div>
  )
}
