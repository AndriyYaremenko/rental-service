import { Icon } from './ui/Icon'
import type { SessionUser } from '@/server/auth/core'

export function TopBar({ title, user, onLogout, onMenu }: { title: string; user?: Pick<SessionUser, 'name' | 'role'>; onLogout?: () => void; onMenu?: () => void }) {
  return (
    <header className="flex justify-between items-center h-16 px-4 md:px-container-margin sticky top-0 z-40 bg-surface-bright border-b border-outline-variant shadow-sm">
      <div className="flex items-center gap-2">
        {onMenu && <button onClick={onMenu} className="p-2 -ml-2 text-on-surface-variant md:hidden" aria-label="Меню"><Icon name="menu" /></button>}
        <h2 className="text-headline-md font-bold text-primary">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="text-right hidden sm:block">
            <p className="text-body-md font-bold leading-none">{user.name}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">{user.role === 'ADMIN' ? 'Адміністратор' : 'Користувач'}</p>
          </div>
        )}
        {onLogout && (
          <button onClick={onLogout} className="p-2 text-on-surface-variant hover:text-primary transition-colors" title="Вийти" aria-label="Вийти"><Icon name="logout" /></button>
        )}
      </div>
    </header>
  )
}
