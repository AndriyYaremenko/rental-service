'use client'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { formatUah } from '@/domain/money'

export interface InvoiceDetailDTO {
  id: string; leaseId: string; year: number; month: number; status: 'UNPAID' | 'PARTIAL' | 'PAID'
  rentKop: number; electricityKop: number; waterKop: number; garbageKop: number; totalKop: number
  electricityRateKop: number; waterRateKop: number
  prevElectricity: string; currElectricity: string; electricityUsed: string
  prevWater: string; currWater: string; waterUsed: string
}
const Row = ({ l, v }: { l: string; v: string }) => (<div className="flex justify-between py-1 text-body-md"><span className="text-on-surface-variant">{l}</span><span className="text-primary">{v}</span></div>)

export function InvoiceDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['invoice', id], queryFn: () => apiFetch<InvoiceDetailDTO>(`/api/invoices/${id}`) })
  const d = q.data
  return (
    <Modal title="Рахунок" onClose={onClose}>
      {!d ? <p className="text-on-surface-variant">Завантаження…</p> : (
        <div className="space-y-4">
          <div>
            <p className="text-label-md uppercase text-on-surface-variant mb-1">Електрика</p>
            <Row l="Показник (поперед. → поточ.)" v={`${d.prevElectricity} → ${d.currElectricity}`} />
            <Row l="Спожито × ставка" v={`${d.electricityUsed} × ${formatUah(d.electricityRateKop)}`} />
            <Row l="Сума" v={formatUah(d.electricityKop)} />
          </div>
          <div>
            <p className="text-label-md uppercase text-on-surface-variant mb-1">Вода</p>
            <Row l="Показник (поперед. → поточ.)" v={`${d.prevWater} → ${d.currWater}`} />
            <Row l="Спожито × ставка" v={`${d.waterUsed} × ${formatUah(d.waterRateKop)}`} />
            <Row l="Сума" v={formatUah(d.waterKop)} />
          </div>
          <div className="border-t border-surface-container pt-2">
            <Row l="Оренда" v={formatUah(d.rentKop)} />
            <Row l="Сміття" v={formatUah(d.garbageKop)} />
            <div className="flex justify-between py-1 font-bold text-primary"><span>Разом</span><span>{formatUah(d.totalKop)}</span></div>
          </div>
          <a href={`/invoices/${d.id}/print`} target="_blank" className="inline-block text-secondary text-body-md font-bold">Версія для друку →</a>
        </div>
      )}
    </Modal>
  )
}
