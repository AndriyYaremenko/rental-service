'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLogin } from '@/hooks/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

export default function LoginPage() {
  const router = useRouter()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate({ email, password }, { onSuccess: () => router.replace('/') })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(26,43,60,0.10)] p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl bg-primary text-on-primary mb-4"><Icon name="apartment" /></div>
          <h1 className="text-headline-md font-bold text-primary">Облік Комерційної Оренди</h1>
          <p className="text-on-surface-variant text-body-md mt-1">Вхід до системи</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Введіть ваш email" />
          <Input label="Пароль" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введіть пароль" />
          {login.isError && <p className="text-error text-body-md">Невірний email або пароль</p>}
          <Button type="submit" variant="navy" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Вхід…' : 'Увійти'}
          </Button>
        </form>
      </div>
    </div>
  )
}
