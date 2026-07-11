import { Icon } from './ui/Icon'
import type { SessionUser } from '@/server/auth/core'

export function TopBar({ title, user, onLogout }: { title: string; user?: Pick<SessionUser, 'name' | 'role'>; onLogout?: () => void }) {
  return (
    <header className="flex justify-between items-center h-16 px-container-margin sticky top-0 z-40 bg-surface-bright border-b border-outline-variant shadow-sm">
      <h2 className="text-headline-md font-bold text-primary">{title}</h2>
      <div className="flex items-center gap-4">
        {user && (
          <div className="text-right">
            <p className="text-body-md font-bold leading-none">{user.name}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">{user.role === 'ADMIN' ? 'Адміністратор' : 'Користувач'}</p>
          </div>
        )}
        {onLogout && (
          <button onClick={onLogout} className="p-2 text-on-surface-variant hover:text-primary transition-colors" title="Вийти">
            <Icon name="logout" />
          </button>
        )}
      </div>
    </header>
  )
}
