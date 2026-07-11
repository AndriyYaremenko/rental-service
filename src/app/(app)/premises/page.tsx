'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusChip } from '@/components/ui/StatusChip'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useList, useRemove } from '@/hooks/crud'
import { errorMessage } from '@/lib/forms'
import { PremisesForm, type PremisesDTO } from './PremisesForm'
import { LocationsPanel } from './LocationsPanel'
import type { LocationDTO } from './LocationForm'

export default function PremisesPage() {
  const list = useList<PremisesDTO>('premises', '/api/premises')
  const locations = useList<LocationDTO>('locations', '/api/locations')
  const remove = useRemove('premises', '/api/premises')
  const [editing, setEditing] = useState<PremisesDTO | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<PremisesDTO | null>(null)
  const [showLocations, setShowLocations] = useState(false)
  const [filter, setFilter] = useState('')

  const locName = new Map((locations.data ?? []).map((l) => [l.id, l.name]))
  const rows = (list.data ?? []).filter((p) => !filter || p.locationId === filter)
  const cols: Column<PremisesDTO>[] = [
    { key: 'unitNumber', header: 'Номер', render: (p) => <span className="text-primary font-bold">{p.unitNumber}</span> },
    { key: 'locationId', header: 'Локація', render: (p) => locName.get(p.locationId) ?? '—' },
    { key: 'type', header: 'Тип', render: (p) => p.type },
    { key: 'areaM2', header: 'Площа, м²', render: (p) => p.areaM2 },
    { key: 'occupied', header: 'Стан', render: (p) => <StatusChip status={p.occupied ? 'ACTIVE' : 'ENDED'} /> },
    { key: 'actions', header: '', className: 'text-right', render: (p) => (
      <span className="inline-flex gap-2 justify-end">
        <button onClick={() => setEditing(p)} className="text-on-surface-variant hover:text-primary" aria-label="Редагувати"><Icon name="edit" /></button>
        <button onClick={() => { setDeleting(p); remove.reset() }} className="text-on-surface-variant hover:text-error" aria-label="Видалити"><Icon name="delete" /></button>
      </span>
    ) },
  ]

  return (
    <>
      <PageHeader title="Приміщення" action={
        <span className="inline-flex gap-3">
          <Button variant="ghost" onClick={() => setShowLocations(true)}><span className="inline-flex items-center gap-2"><Icon name="domain" />Локації</span></Button>
          <Button variant="navy" onClick={() => setEditing(null)}><span className="inline-flex items-center gap-2"><Icon name="add" />Додати приміщення</span></Button>
        </span>
      } />
      <div className="mb-stack-md">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2 text-body-md">
          <option value="">Усі локації</option>
          {(locations.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container">
        {list.isLoading ? <p className="text-on-surface-variant">Завантаження…</p>
          : <DataTable columns={cols} rows={rows} empty="Приміщень ще немає" />}
      </div>
      {editing !== undefined && <PremisesForm premises={editing ?? undefined} defaultLocationId={filter || undefined} onClose={() => setEditing(undefined)} />}
      {showLocations && <LocationsPanel onClose={() => setShowLocations(false)} />}
      {deleting && (
        <ConfirmDialog title="Видалити приміщення?" message={`Приміщення «${deleting.unitNumber}» буде видалене.`}
          error={remove.isError ? errorMessage(remove.error) : null} pending={remove.isPending}
          onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })} />
      )}
    </>
  )
}
