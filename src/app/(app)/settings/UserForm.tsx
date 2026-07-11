'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useCreate, useUpdate } from '@/hooks/crud'
import { fieldErrors, errorMessage } from '@/lib/forms'

export interface UserDTO { id: string; email: string; name: string; role: 'ADMIN' | 'USER'; isActive: boolean }

export function UserForm({ user, onClose }: { user?: UserDTO; onClose: () => void }) {
  const create = useCreate<Record<string, unknown>, UserDTO>('users', '/api/users')
  const update = useUpdate<Record<string, unknown>, UserDTO>('users', '/api/users')
  const [f, setF] = useState({
    email: user?.email ?? '', name: user?.name ?? '', role: user?.role ?? 'USER',
    password: '', isActive: user?.isActive ?? true,
  })
  const m = user ? update : create
  const errs = fieldErrors(m.error)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const opts = { onSuccess: () => onClose() }
    if (user) {
      const body: Record<string, unknown> = { name: f.name, role: f.role, isActive: f.isActive }
      if (f.password) body.password = f.password // пароль лише якщо введено
      update.mutate({ id: user.id, body }, opts)
    } else {
      create.mutate({ email: f.email, name: f.name, role: f.role, password: f.password }, opts)
    }
  }
  return (
    <Modal title={user ? 'Редагувати користувача' : 'Новий користувач'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!user && <Input label="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errs.email} />}
        <Input label="Ім'я" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errs.name} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Роль" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as 'ADMIN' | 'USER' })} error={errs.role}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </Select>
          <Input label={user ? 'Новий пароль (опц.)' : 'Пароль'} type="password" required={!user} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={errs.password} placeholder="щонайменше 8" />
        </div>
        {user && (
          <label className="flex items-center gap-2 text-body-md text-on-surface">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Активний
          </label>
        )}
        {m.isError && Object.keys(errs).length === 0 && <p className="text-error text-body-md">{errorMessage(m.error)}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Скасувати</Button>
          <Button type="submit" variant="navy" disabled={m.isPending}>{m.isPending ? 'Збереження…' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  )
}
