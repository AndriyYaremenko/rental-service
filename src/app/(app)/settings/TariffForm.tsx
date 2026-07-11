'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreate } from '@/hooks/crud'
import { fieldErrors, errorMessage } from '@/lib/forms'

export interface TariffDTO { id: string; effectiveFrom: string; electricityRateKop: number; waterRateKop: number }

export function TariffForm({ onClose }: { onClose: () => void }) {
  const create = useCreate<Record<string, string>, TariffDTO>('tariffs', '/api/tariffs')
  const [f, setF] = useState({ effectiveFrom: '', electricityUah: '', waterUah: '' })
  const errs = fieldErrors(create.error)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const submit = (e: React.FormEvent) => { e.preventDefault(); create.mutate(f, { onSuccess: () => onClose() }) }
  return (
    <Modal title="Новий тариф" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Діє з" type="date" required value={f.effectiveFrom} onChange={set('effectiveFrom')} error={errs.effectiveFrom} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Електрика, грн/кВт·год" required value={f.electricityUah} onChange={set('electricityUah')} error={errs.rate} placeholder="напр. 4.32" />
          <Input label="Вода, грн/м³" required value={f.waterUah} onChange={set('waterUah')} error={errs.rate} placeholder="напр. 12.50" />
        </div>
        {create.isError && Object.keys(errs).length === 0 && <p className="text-error text-body-md">{errorMessage(create.error)}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Скасувати</Button>
          <Button type="submit" variant="navy" disabled={create.isPending}>{create.isPending ? 'Збереження…' : 'Додати'}</Button>
        </div>
      </form>
    </Modal>
  )
}
