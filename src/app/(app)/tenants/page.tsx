'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useList, useRemove } from '@/hooks/crud'
import { errorMessage } from '@/lib/forms'
import { TenantForm, type TenantDTO } from './TenantForm'

export default function TenantsPage() {
  const list = useList<TenantDTO>('tenants', '/api/tenants')
  const remove = useRemove('tenants', '/api/tenants')
  const [editing, setEditing] = useState<TenantDTO | null | undefined>(undefined) // undefined=closed, null=new
  const [deleting, setDeleting] = useState<TenantDTO | null>(null)

  const cols: Column<TenantDTO>[] = [
    { key: 'name', header: 'Назва', render: (t) => <span className="text-primary font-bold">{t.name}</span> },
    { key: 'phone', header: 'Телефон', render: (t) => t.phone ?? '—' },
    { key: 'email', header: 'Email', render: (t) => t.email ?? '—' },
    { key: 'taxCode', header: 'Код', render: (t) => t.taxCode ?? '—' },
    { key: 'actions', header: '', className: 'text-right', render: (t) => (
      <span className="inline-flex gap-2 justify-end">
        <button onClick={() => setEditing(t)} className="text-on-surface-variant hover:text-primary" aria-label="Редагувати"><Icon name="edit" /></button>
        <button onClick={() => { setDeleting(t); remove.reset() }} className="text-on-surface-variant hover:text-error" aria-label="Видалити"><Icon name="delete" /></button>
      </span>
    ) },
  ]

  return (
    <>
      <PageHeader title="Орендарі" action={<Button variant="navy" onClick={() => setEditing(null)}><span className="inline-flex items-center gap-2"><Icon name="add" />Додати орендаря</span></Button>} />
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container">
        {list.isLoading ? <p className="text-on-surface-variant">Завантаження…</p>
          : <DataTable columns={cols} rows={list.data ?? []} empty="Орендарів ще немає" />}
      </div>
      {editing !== undefined && <TenantForm tenant={editing ?? undefined} onClose={() => setEditing(undefined)} />}
      {deleting && (
        <ConfirmDialog title="Видалити орендаря?" message={`Орендар «${deleting.name}» буде видалений.`}
          error={remove.isError ? errorMessage(remove.error) : null} pending={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })} />
      )}
    </>
  )
}
