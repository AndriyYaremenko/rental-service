'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { NAV_ITEMS } from '@/components/Sidebar'
import { useMe, useLogout } from '@/hooks/auth'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const me = useMe()
  const logout = useLogout()

  useEffect(() => {
    if (me.isError) router.replace('/login')
  }, [me.isError, router])

  const title = NAV_ITEMS.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)))?.label ?? 'Облік Оренди'
  const onLogout = () => logout.mutate(undefined, { onSuccess: () => router.replace('/login') })

  if (me.isLoading) return <div className="p-container-margin text-on-surface-variant">Завантаження…</div>
  return <AppShell title={title} user={me.data ?? undefined} onLogout={onLogout}>{children}</AppShell>
}
