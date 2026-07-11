'use client'
import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { MobileDrawer, BottomNav } from './MobileNav'
import { TopBar } from './TopBar'
import type { SessionUser } from '@/server/auth/core'

export function AppShell({ title, user, onLogout, children }: { title: string; user?: Pick<SessionUser, 'name' | 'role'>; onLogout?: () => void; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false)
  return (
    <>
      <Sidebar />
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      <div className="md:ml-64 flex flex-col min-h-screen">
        <TopBar title={title} user={user} onLogout={onLogout} onMenu={() => setDrawer(true)} />
        <main className="p-4 md:p-container-margin flex-1 pb-24 md:pb-6">{children}</main>
      </div>
      <BottomNav onMore={() => setDrawer(true)} />
    </>
  )
}
