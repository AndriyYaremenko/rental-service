'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { useCreate, useUpdate } from '@/hooks/crud'
import { fieldErrors, errorMessage } from '@/lib/forms'

export interface LocationDTO { id: string; name: string; address: string; notes: string | null }

export function LocationForm({ location, onClose }: { location?: LocationDTO; onClose: () => void }) {
  const create = useCreate<Record<string, string>, LocationDTO>('locations', '/api/locations')
  const update = useUpdate<Record<string, string>, LocationDTO>('locations', '/api/locations')
  const [f, setF] = useState({ name: location?.name ?? '', address: location?.address ?? '', notes: location?.notes ?? '' })
  const m = location ? update : create
  const errs = fieldErrors(m.error)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const opts = { onSuccess: () => onClose() }
    if (location) update.mutate({ id: location.id, body: f }, opts); else create.mutate(f, opts)
  }
  return (
    <Modal title={location ? 'Редагувати локацію' : 'Нова локація'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Назва" required value={f.name} onChange={set('name')} error={errs.name} />
        <Input label="Адреса" required value={f.address} onChange={set('address')} error={errs.address} />
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
