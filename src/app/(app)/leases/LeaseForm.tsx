'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useCreate, useUpdate, useList } from '@/hooks/crud'
import { fieldErrors, errorMessage } from '@/lib/forms'

export interface LeaseDTO { id: string; premisesId: string; tenantId: string; startDate: string; endDate: string | null; rentKop: number; garbageKop: number; status: 'ACTIVE' | 'ENDED' }
interface PremisesDTO { id: string; unitNumber: string; locationId: string }
interface TenantDTO { id: string; name: string }

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
const uah = (kop: number) => (kop / 100).toFixed(2)

export function LeaseForm({ lease, onClose }: { lease?: LeaseDTO; onClose: () => void }) {
  const premises = useList<PremisesDTO>('premises', '/api/premises')
  const tenants = useList<TenantDTO>('tenants', '/api/tenants')
  const create = useCreate<Record<string, unknown>, LeaseDTO>('leases', '/api/leases')
  const update = useUpdate<Record<string, unknown>, LeaseDTO>('leases', '/api/leases')
  const [f, setF] = useState({
    premisesId: lease?.premisesId ?? '', tenantId: lease?.tenantId ?? '',
    startDate: day(lease?.startDate ?? null), endDate: day(lease?.endDate ?? null),
    rentUah: lease ? uah(lease.rentKop) : '', garbageUah: lease ? uah(lease.garbageKop) : '',
  })
  const m = lease ? update : create
  const errs = fieldErrors(m.error)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = { premisesId: f.premisesId, tenantId: f.tenantId, startDate: f.startDate, endDate: f.endDate || null, rentUah: f.rentUah, garbageUah: f.garbageUah }
    const opts = { onSuccess: () => onClose() }
    if (lease) update.mutate({ id: lease.id, body }, opts); else create.mutate(body, opts)
  }
  return (
    <Modal title={lease ? 'Редагувати договір' : 'Новий договір'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Select label="Приміщення" required value={f.premisesId} onChange={set('premisesId')} error={errs.premisesId}>
          <option value="" disabled>Оберіть приміщення</option>
          {(premises.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.unitNumber}</option>)}
        </Select>
        <Select label="Орендар" required value={f.tenantId} onChange={set('tenantId')} error={errs.tenantId}>
          <option value="" disabled>Оберіть орендаря</option>
          {(tenants.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Початок" type="date" required value={f.startDate} onChange={set('startDate')} error={errs.startDate} />
          <Input label="Кінець (опц.)" type="date" value={f.endDate} onChange={set('endDate')} error={errs.endDate} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Оренда/міс, грн" required value={f.rentUah} onChange={set('rentUah')} error={errs.rent} placeholder="напр. 18000.00" />
          <Input label="Сміття/міс, грн" required value={f.garbageUah} onChange={set('garbageUah')} error={errs.rent} placeholder="напр. 300.00" />
        </div>
        {m.isError && Object.keys(errs).length === 0 && <p className="text-error text-body-md">{errorMessage(m.error)}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Скасувати</Button>
          <Button type="submit" variant="navy" disabled={m.isPending}>{m.isPending ? 'Збереження…' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  )
}
