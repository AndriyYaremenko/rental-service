'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { useCreate, useUpdate, useList } from '@/hooks/crud'
import { fieldErrors, errorMessage } from '@/lib/forms'

export interface PaymentDTO { id: string; leaseId: string; date: string; amountKop: number; method: 'CASH' | 'CARD' | 'BANK'; note: string | null }
interface LeaseLite { id: string; premisesId: string; tenantId: string }
const uah = (kop: number) => (kop / 100).toFixed(2)

export function PaymentForm({ payment, leaseLabel, onClose }: { payment?: PaymentDTO; leaseLabel: (id: string) => string; onClose: () => void }) {
  const leases = useList<LeaseLite>('leases', '/api/leases')
  const create = useCreate<Record<string, unknown>, PaymentDTO>('payments', '/api/payments')
  const update = useUpdate<Record<string, unknown>, PaymentDTO>('payments', '/api/payments')
  const [f, setF] = useState({
    leaseId: payment?.leaseId ?? '', date: payment ? payment.date.slice(0, 10) : '',
    amountUah: payment ? uah(payment.amountKop) : '', method: payment?.method ?? 'CASH', note: payment?.note ?? '',
  })
  const m = payment ? update : create
  const errs = fieldErrors(m.error)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { leaseId: f.leaseId, date: f.date, amountUah: f.amountUah, method: f.method, note: f.note }
    const opts = { onSuccess: () => onClose() }
    if (payment) update.mutate({ id: payment.id, body }, opts); else create.mutate(body, opts)
  }
  return (
    <Modal title={payment ? 'Редагувати оплату' : 'Нова оплата'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Select label="Договір" required value={f.leaseId} onChange={(e) => setF({ ...f, leaseId: e.target.value })} error={errs.leaseId}>
          <option value="" disabled>Оберіть договір</option>
          {(leases.data ?? []).map((l) => <option key={l.id} value={l.id}>{leaseLabel(l.id)}</option>)}
        </Select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Дата" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} error={errs.date} />
          <Input label="Сума, грн" required value={f.amountUah} onChange={(e) => setF({ ...f, amountUah: e.target.value })} error={errs.amount} placeholder="напр. 5000.00" />
        </div>
        <Select label="Метод" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaymentDTO['method'] })} error={errs.method}>
          <option value="CASH">Готівка</option>
          <option value="CARD">Картка</option>
          <option value="BANK">Рахунок</option>
        </Select>
        <Textarea label="Примітка" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} error={errs.note} />
        {m.isError && Object.keys(errs).length === 0 && <p className="text-error text-body-md">{errorMessage(m.error)}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Скасувати</Button>
          <Button type="submit" variant="navy" disabled={m.isPending}>{m.isPending ? 'Збереження…' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  )
}
