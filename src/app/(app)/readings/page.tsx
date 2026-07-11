'use client'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { errorMessage } from '@/lib/forms'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useMonth, MonthPicker } from '@/lib/period'

interface Row { premisesId: string; unitNumber: string; locationName: string; current: { electricity: string; water: string } | null; previous: { electricity: string; water: string } | null }
type Draft = Record<string, { electricity: string; water: string; electricityReplaced: boolean; waterReplaced: boolean }>

const now = new Date()
export default function ReadingsPage() {
  const qc = useQueryClient()
  const { year, month, setYear, setMonth } = useMonth(now.getUTCFullYear(), now.getUTCMonth() + 1)
  const rows = useQuery({ queryKey: ['readings', year, month], queryFn: () => apiFetch<Row[]>(`/api/readings?year=${year}&month=${month}`) })
  const [draft, setDraft] = useState<Draft>({})
  useEffect(() => {
    const d: Draft = {}
    for (const r of rows.data ?? []) d[r.premisesId] = { electricity: r.current?.electricity ?? '', water: r.current?.water ?? '', electricityReplaced: false, waterReplaced: false }
    setDraft(d)
  }, [rows.data])

  const save = useMutation({
    mutationFn: () => {
      const entries = (rows.data ?? [])
        .filter((r) => draft[r.premisesId]?.electricity !== '' && draft[r.premisesId]?.water !== '')
        .map((r) => {
          const dr = draft[r.premisesId]
          const e: Record<string, unknown> = { premisesId: r.premisesId, electricity: dr.electricity, water: dr.water }
          // Заміна лічильника: новий стартує з 0 (база), інакше споживання рахується
          // від null → зламає нарахування. Тож при заміні шлемо replacedInitial='0'.
          if (dr.electricityReplaced) { e.electricityReplaced = true; e.electricityReplacedInitial = '0' }
          if (dr.waterReplaced) { e.waterReplaced = true; e.waterReplacedInitial = '0' }
          return e
        })
      return apiFetch<{ saved: number }>('/api/readings', { method: 'POST', body: JSON.stringify({ year, month, entries }) })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['readings', year, month] }),
  })
  const upd = (id: string, k: 'electricity' | 'water' | 'electricityReplaced' | 'waterReplaced', v: string | boolean) => setDraft((d) => ({ ...d, [id]: { ...d[id], [k]: v } }))

  return (
    <>
      <PageHeader title="Показники" action={<span className="inline-flex items-center gap-3"><MonthPicker year={year} month={month} setYear={setYear} setMonth={setMonth} /><Button variant="navy" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Збереження…' : 'Зберегти показники'}</Button></span>} />
      {save.isError && <p className="text-error text-body-md mb-4">{errorMessage(save.error)}</p>}
      {save.isSuccess && <p className="text-secondary text-body-md mb-4">Збережено.</p>}
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="text-on-surface-variant border-b border-surface-container">
            <th className="py-3 text-label-md uppercase tracking-wider">Приміщення</th>
            <th className="py-3 text-label-md uppercase tracking-wider">Електрика (поперед.)</th>
            <th className="py-3 text-label-md uppercase tracking-wider">Заміна</th>
            <th className="py-3 text-label-md uppercase tracking-wider">Вода (поперед.)</th>
            <th className="py-3 text-label-md uppercase tracking-wider">Заміна</th>
          </tr></thead>
          <tbody className="divide-y divide-surface-container">
            {(rows.data ?? []).map((r) => (
              <tr key={r.premisesId} className="hover:bg-surface-container-low">
                <td className="py-3 text-body-md"><span className="text-primary font-bold">{r.unitNumber}</span> <span className="text-on-surface-variant">· {r.locationName}</span></td>
                <td className="py-3">
                  <input value={draft[r.premisesId]?.electricity ?? ''} onChange={(e) => upd(r.premisesId, 'electricity', e.target.value)} className="w-28 border border-outline-variant rounded-lg px-3 py-1.5 text-body-md" placeholder={r.previous?.electricity ?? '—'} />
                  {r.previous && <span className="text-on-surface-variant text-body-md ml-2">({r.previous.electricity})</span>}
                </td>
                <td className="py-3"><input type="checkbox" checked={draft[r.premisesId]?.electricityReplaced ?? false} onChange={(e) => upd(r.premisesId, 'electricityReplaced', e.target.checked)} /></td>
                <td className="py-3">
                  <input value={draft[r.premisesId]?.water ?? ''} onChange={(e) => upd(r.premisesId, 'water', e.target.value)} className="w-28 border border-outline-variant rounded-lg px-3 py-1.5 text-body-md" placeholder={r.previous?.water ?? '—'} />
                  {r.previous && <span className="text-on-surface-variant text-body-md ml-2">({r.previous.water})</span>}
                </td>
                <td className="py-3"><input type="checkbox" checked={draft[r.premisesId]?.waterReplaced ?? false} onChange={(e) => upd(r.premisesId, 'waterReplaced', e.target.checked)} /></td>
              </tr>
            ))}
            {(rows.data ?? []).length === 0 && <tr><td colSpan={5} className="py-8 text-center text-on-surface-variant text-body-md">Немає приміщень з активним договором у цьому місяці</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
