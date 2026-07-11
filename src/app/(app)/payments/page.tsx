'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useList, useRemove } from '@/hooks/crud'
import { errorMessage } from '@/lib/forms'
import { formatUah } from '@/domain/money'
import { PaymentForm, type PaymentDTO } from './PaymentForm'

interface Named { id: string; unitNumber?: string; name?: string }
interface LeaseLite { id: string; premisesId: string; tenantId: string }

const METHOD_LABEL: Record<PaymentDTO['method'], string> = { CASH: 'Готівка', CARD: 'Картка', BANK: 'Рахунок' }

export default function PaymentsPage() {
  const list = useList<PaymentDTO>('payments', '/api/payments')
  const leases = useList<LeaseLite>('leases', '/api/leases')
  const premises = useList<Named>('premises', '/api/premises')
  const tenants = useList<Named>('tenants', '/api/tenants')
  const remove = useRemove('payments', '/api/payments')
  const [editing, setEditing] = useState<PaymentDTO | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<PaymentDTO | null>(null)

  const leaseMap = new Map((leases.data ?? []).map((l) => [l.id, l]))
  const premName = new Map((premises.data ?? []).map((p) => [p.id, p.unitNumber ?? '']))
  const tenName = new Map((tenants.data ?? []).map((t) => [t.id, t.name ?? '']))
  const leaseLabel = (id: string) => {
    const l = leaseMap.get(id)
    if (!l) return '—'
    return `${premName.get(l.premisesId) ?? '—'} · ${tenName.get(l.tenantId) ?? '—'}`
  }

  const cols: Column<PaymentDTO>[] = [
    { key: 'date', header: 'Дата', render: (p) => p.date.slice(0, 10) },
    { key: 'leaseId', header: 'Договір', render: (p) => <span className="text-primary font-bold">{leaseLabel(p.leaseId)}</span> },
    { key: 'amountKop', header: 'Сума', render: (p) => formatUah(p.amountKop) },
    { key: 'method', header: 'Метод', render: (p) => METHOD_LABEL[p.method] },
    { key: 'note', header: 'Примітка', render: (p) => p.note ?? '—' },
    { key: 'actions', header: '', className: 'text-right', render: (p) => (
      <span className="inline-flex gap-2 justify-end">
        <button onClick={() => setEditing(p)} className="text-on-surface-variant hover:text-primary" aria-label="Редагувати"><Icon name="edit" /></button>
        <button onClick={() => { setDeleting(p); remove.reset() }} className="text-on-surface-variant hover:text-error" aria-label="Видалити"><Icon name="delete" /></button>
      </span>
    ) },
  ]
  return (
    <>
      <PageHeader title="Оплати" action={<Button variant="navy" onClick={() => setEditing(null)}><span className="inline-flex items-center gap-2"><Icon name="add" />Додати оплату</span></Button>} />
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container">
        {list.isLoading ? <p className="text-on-surface-variant">Завантаження…</p> : <DataTable columns={cols} rows={list.data ?? []} empty="Оплат ще немає" />}
      </div>
      {editing !== undefined && <PaymentForm payment={editing ?? undefined} leaseLabel={leaseLabel} onClose={() => setEditing(undefined)} />}
      {deleting && <ConfirmDialog title="Видалити оплату?" message="Оплату буде видалено." error={remove.isError ? errorMessage(remove.error) : null} pending={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })} />}
    </>
  )
}
