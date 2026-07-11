import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import type { SessionUser } from '@/server/auth/core'

export function AppShell({ title, user, onLogout, children }: { title: string; user?: Pick<SessionUser, 'name' | 'role'>; onLogout?: () => void; children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="ml-64 flex flex-col min-h-screen">
        <TopBar title={title} user={user} onLogout={onLogout} />
        <main className="p-container-margin flex-1">{children}</main>
      </div>
    </>
  )
}
