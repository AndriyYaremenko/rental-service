'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { useCreate, useUpdate } from '@/hooks/crud'
import { fieldErrors, errorMessage } from '@/lib/forms'

export interface TenantDTO { id: string; name: string; phone: string | null; email: string | null; taxCode: string | null; notes: string | null }

export function TenantForm({ tenant, onClose }: { tenant?: TenantDTO; onClose: () => void }) {
  const create = useCreate<Record<string, string>, TenantDTO>('tenants', '/api/tenants')
  const update = useUpdate<Record<string, string>, TenantDTO>('tenants', '/api/tenants')
  const [f, setF] = useState({
    name: tenant?.name ?? '', phone: tenant?.phone ?? '', email: tenant?.email ?? '',
    taxCode: tenant?.taxCode ?? '', notes: tenant?.notes ?? '',
  })
  const m = tenant ? update : create
  const errs = fieldErrors(m.error)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const opts = { onSuccess: () => onClose() }
    if (tenant) update.mutate({ id: tenant.id, body: f }, opts)
    else create.mutate(f, opts)
  }

  return (
    <Modal title={tenant ? 'Редагувати орендаря' : 'Новий орендар'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Назва / ПІБ" required value={f.name} onChange={set('name')} error={errs.name} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Телефон" value={f.phone} onChange={set('phone')} error={errs.phone} />
          <Input label="Email" type="email" value={f.email} onChange={set('email')} error={errs.email} />
        </div>
        <Input label="Податковий код" value={f.taxCode} onChange={set('taxCode')} error={errs.taxCode} />
        <Textarea label="Примітки" value={f.notes} onChange={set('notes')} error={errs.notes} />
        {m.isError && Object.keys(errs).length === 0 && <p className="text-error text-body-md">{errorMessage(m.error)}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Скасувати</Button>
          <Button type="submit" variant="navy" disabled={m.isPending}>{m.isPending ? 'Збереження…' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  )
}
