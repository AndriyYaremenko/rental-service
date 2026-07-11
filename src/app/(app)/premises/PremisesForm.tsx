'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { useCreate, useUpdate, useList } from '@/hooks/crud'
import { fieldErrors, errorMessage } from '@/lib/forms'
import type { LocationDTO } from './LocationForm'

export interface PremisesDTO { id: string; locationId: string; unitNumber: string; type: string; floor: number | null; areaM2: string; notes: string | null; occupied: boolean }

export function PremisesForm({ premises, defaultLocationId, onClose }: { premises?: PremisesDTO; defaultLocationId?: string; onClose: () => void }) {
  const locations = useList<LocationDTO>('locations', '/api/locations')
  const create = useCreate<Record<string, unknown>, PremisesDTO>('premises', '/api/premises')
  const update = useUpdate<Record<string, unknown>, PremisesDTO>('premises', '/api/premises')
  const [f, setF] = useState({
    locationId: premises?.locationId ?? defaultLocationId ?? '',
    unitNumber: premises?.unitNumber ?? '', type: premises?.type ?? '',
    floor: premises?.floor != null ? String(premises.floor) : '',
    areaM2: premises?.areaM2 ?? '', notes: premises?.notes ?? '',
  })
  const m = premises ? update : create
  const errs = fieldErrors(m.error)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = {
      locationId: f.locationId, unitNumber: f.unitNumber, type: f.type,
      areaM2: f.areaM2, notes: f.notes,
      floor: f.floor === '' ? null : Number(f.floor),
    }
    const opts = { onSuccess: () => onClose() }
    if (premises) update.mutate({ id: premises.id, body }, opts); else create.mutate(body, opts)
  }
  return (
    <Modal title={premises ? 'Редагувати приміщення' : 'Нове приміщення'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Select label="Локація" required value={f.locationId} onChange={set('locationId')} error={errs.locationId}>
          <option value="" disabled>Оберіть локацію</option>
          {(locations.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Номер / одиниця" required value={f.unitNumber} onChange={set('unitNumber')} error={errs.unitNumber} />
          <Input label="Тип (офіс, магазин…)" required value={f.type} onChange={set('type')} error={errs.type} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Поверх" type="number" value={f.floor} onChange={set('floor')} error={errs.floor} />
          <Input label="Площа, м²" required value={f.areaM2} onChange={set('areaM2')} error={errs.areaM2} placeholder="напр. 24.5" />
        </div>
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
