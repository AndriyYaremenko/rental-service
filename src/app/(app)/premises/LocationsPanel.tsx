'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useList, useRemove } from '@/hooks/crud'
import { errorMessage } from '@/lib/forms'
import { LocationForm, type LocationDTO } from './LocationForm'

export function LocationsPanel({ onClose }: { onClose: () => void }) {
  const list = useList<LocationDTO>('locations', '/api/locations')
  const remove = useRemove('locations', '/api/locations')
  const [editing, setEditing] = useState<LocationDTO | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<LocationDTO | null>(null)
  return (
    <Modal title="Локації" onClose={onClose}>
      <div className="flex justify-end mb-4">
        <Button variant="navy" onClick={() => setEditing(null)}><span className="inline-flex items-center gap-2"><Icon name="add" />Додати локацію</span></Button>
      </div>
      <div className="divide-y divide-surface-container max-h-80 overflow-y-auto">
        {(list.data ?? []).map((l) => (
          <div key={l.id} className="flex items-center justify-between py-3">
            <div><p className="text-body-md font-bold text-primary">{l.name}</p><p className="text-body-md text-on-surface-variant">{l.address}</p></div>
            <span className="inline-flex gap-2">
              <button onClick={() => setEditing(l)} className="text-on-surface-variant hover:text-primary" aria-label="Редагувати"><Icon name="edit" /></button>
              <button onClick={() => { setDeleting(l); remove.reset() }} className="text-on-surface-variant hover:text-error" aria-label="Видалити"><Icon name="delete" /></button>
            </span>
          </div>
        ))}
        {(list.data ?? []).length === 0 && <p className="py-6 text-center text-on-surface-variant text-body-md">Локацій ще немає</p>}
      </div>
      {editing !== undefined && <LocationForm location={editing ?? undefined} onClose={() => setEditing(undefined)} />}
      {deleting && (
        <ConfirmDialog title="Видалити локацію?" message={`Локація «${deleting.name}» буде видалена.`}
          error={remove.isError ? errorMessage(remove.error) : null} pending={remove.isPending}
          onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })} />
      )}
    </Modal>
  )
}
