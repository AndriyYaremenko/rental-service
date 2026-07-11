'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusChip } from '@/components/ui/StatusChip'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useList, useRemove } from '@/hooks/crud'
import { errorMessage } from '@/lib/forms'
import { formatUah } from '@/domain/money'
import { LeaseForm, type LeaseDTO } from './LeaseForm'

interface Named { id: string; unitNumber?: string; name?: string }

export default function LeasesPage() {
  const list = useList<LeaseDTO>('leases', '/api/leases')
  const premises = useList<Named>('premises', '/api/premises')
  const tenants = useList<Named>('tenants', '/api/tenants')
  const remove = useRemove('leases', '/api/leases')
  const [editing, setEditing] = useState<LeaseDTO | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<LeaseDTO | null>(null)
  const premName = new Map((premises.data ?? []).map((p) => [p.id, p.unitNumber ?? '']))
  const tenName = new Map((tenants.data ?? []).map((t) => [t.id, t.name ?? '']))
  const period = (l: LeaseDTO) => `${l.startDate.slice(0, 10)} — ${l.endDate ? l.endDate.slice(0, 10) : '…'}`

  const cols: Column<LeaseDTO>[] = [
    { key: 'premisesId', header: 'Приміщення', render: (l) => <span className="text-primary font-bold">{premName.get(l.premisesId) ?? '—'}</span> },
    { key: 'tenantId', header: 'Орендар', render: (l) => tenName.get(l.tenantId) ?? '—' },
    { key: 'period', header: 'Період', render: period },
    { key: 'rentKop', header: 'Оренда/міс', render: (l) => formatUah(l.rentKop) },
    { key: 'status', header: 'Статус', render: (l) => <StatusChip status={l.status} /> },
    { key: 'actions', header: '', className: 'text-right', render: (l) => (
      <span className="inline-flex gap-2 justify-end">
        <button onClick={() => setEditing(l)} className="text-on-surface-variant hover:text-primary" aria-label="Редагувати"><Icon name="edit" /></button>
        <button onClick={() => { setDeleting(l); remove.reset() }} className="text-on-surface-variant hover:text-error" aria-label="Видалити"><Icon name="delete" /></button>
      </span>
    ) },
  ]
  return (
    <>
      <PageHeader title="Договори" action={<Button variant="navy" onClick={() => setEditing(null)}><span className="inline-flex items-center gap-2"><Icon name="add" />Додати договір</span></Button>} />
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container">
        {list.isLoading ? <p className="text-on-surface-variant">Завантаження…</p> : <DataTable columns={cols} rows={list.data ?? []} empty="Договорів ще немає" />}
      </div>
      {editing !== undefined && <LeaseForm lease={editing ?? undefined} onClose={() => setEditing(undefined)} />}
      {deleting && <ConfirmDialog title="Видалити договір?" message="Договір буде видалено." error={remove.isError ? errorMessage(remove.error) : null} pending={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })} />}
    </>
  )
}
