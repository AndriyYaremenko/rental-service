'use client'
import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { formatUah } from '@/domain/money'
import type { InvoiceDetailDTO } from '../../../(app)/invoices/InvoiceDetail'

export default function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const q = useQuery({ queryKey: ['invoice', id], queryFn: () => apiFetch<InvoiceDetailDTO>(`/api/invoices/${id}`) })
  const d = q.data
  if (!d) return <div className="p-8 text-on-surface-variant">Завантаження…</div>
  const line = (l: string, v: string) => (<tr><td className="py-1">{l}</td><td className="py-1 text-right">{v}</td></tr>)
  return (
    <div className="max-w-2xl mx-auto p-8 text-on-surface">
      <div className="flex justify-between items-start mb-8">
        <div><h1 className="text-headline-md font-bold text-primary">Рахунок</h1><p className="text-on-surface-variant">{d.month}/{d.year}</p></div>
        <button onClick={() => window.print()} className="print:hidden px-4 py-2 rounded-lg bg-primary text-on-primary font-bold">Друк</button>
      </div>
      <table className="w-full text-body-md">
        <tbody>
          {line('Оренда', formatUah(d.rentKop))}
          {line(`Електрика (${d.electricityUsed} × ${formatUah(d.electricityRateKop)})`, formatUah(d.electricityKop))}
          {line(`Вода (${d.waterUsed} × ${formatUah(d.waterRateKop)})`, formatUah(d.waterKop))}
          {line('Сміття', formatUah(d.garbageKop))}
        </tbody>
        <tfoot><tr className="border-t border-outline"><td className="py-2 font-bold">Разом</td><td className="py-2 text-right font-bold">{formatUah(d.totalKop)}</td></tr></tfoot>
      </table>
    </div>
  )
}
