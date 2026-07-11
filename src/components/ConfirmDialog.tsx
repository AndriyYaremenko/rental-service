'use client'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

export function ConfirmDialog({ title, message, error, pending, onConfirm, onCancel }: { title: string; message: string; error?: string | null; pending?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-body-md text-on-surface-variant mb-2">{message}</p>
      {error && <p className="text-body-md text-error mb-4">{error}</p>}
      <div className="flex justify-end gap-3 mt-4">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>Скасувати</Button>
        <Button variant="navy" onClick={onConfirm} disabled={pending} className="bg-error hover:bg-error">{pending ? 'Видалення…' : 'Видалити'}</Button>
      </div>
    </Modal>
  )
}
