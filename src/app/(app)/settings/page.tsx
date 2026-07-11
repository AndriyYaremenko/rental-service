'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useList, useRemove } from '@/hooks/crud'
import { errorMessage } from '@/lib/forms'
import { formatUah } from '@/domain/money'
import { TariffForm, type TariffDTO } from './TariffForm'

function TariffsCard() {
  const list = useList<TariffDTO>('tariffs', '/api/tariffs')
  const remove = useRemove('tariffs', '/api/tariffs')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<TariffDTO | null>(null)
  const fmtDate = (iso: string) => iso.slice(0, 10)
  const cols: Column<TariffDTO>[] = [
    { key: 'effectiveFrom', header: 'Діє з', render: (t) => fmtDate(t.effectiveFrom) },
    { key: 'electricityRateKop', header: 'Електрика, грн/кВт·год', render: (t) => formatUah(t.electricityRateKop) },
    { key: 'waterRateKop', header: 'Вода, грн/м³', render: (t) => formatUah(t.waterRateKop) },
    { key: 'actions', header: '', className: 'text-right', render: (t) => (
      <button onClick={() => { setDeleting(t); remove.reset() }} className="text-on-surface-variant hover:text-error" aria-label="Видалити"><Icon name="delete" /></button>
    ) },
  ]
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-headline-sm font-bold text-primary">Тарифи</h3>
        <Button variant="navy" onClick={() => setAdding(true)}><span className="inline-flex items-center gap-2"><Icon name="add" />Додати тариф</span></Button>
      </div>
      <DataTable columns={cols} rows={list.data ?? []} empty="Тарифів ще немає" />
      {adding && <TariffForm onClose={() => setAdding(false)} />}
      {deleting && (
        <ConfirmDialog title="Видалити тариф?" message={`Тариф від ${fmtDate(deleting.effectiveFrom)} буде видалений.`}
          error={remove.isError ? errorMessage(remove.error) : null} pending={remove.isPending}
          onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })} />
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Налаштування" />
      <div className="space-y-stack-lg">
        <TariffsCard />
        {/* Секцію «Користувачі» додасть Task 6 */}
      </div>
    </>
  )
}
