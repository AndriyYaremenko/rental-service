'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './ui/Icon'
import { NavList, isActive } from './Sidebar'

const QUICK = [
  { href: '/', label: 'Дашборд', icon: 'dashboard' },
  { href: '/premises', label: 'Приміщення', icon: 'domain' },
  { href: '/invoices', label: 'Нарахування', icon: 'receipt_long' },
  { href: '/payments', label: 'Оплати', icon: 'payments' },
]

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" />
      <aside className="absolute left-0 top-0 h-full w-72 bg-surface flex flex-col py-stack-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-headline-sm font-bold text-primary">Облік Оренди</h1>
            <p className="text-on-surface-variant text-body-md">Комерційна нерухомість</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant p-1" aria-label="Закрити"><Icon name="close" /></button>
        </div>
        <NavList onNavigate={onClose} />
      </aside>
    </div>
  )
}

export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 h-16 bg-surface-container-lowest border-t border-outline-variant flex items-stretch md:hidden">
      {QUICK.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link key={item.href} href={item.href} className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${active ? 'text-secondary' : 'text-on-surface-variant'}`}>
            <Icon name={item.icon} /><span className="text-[10px] font-semibold">{item.label}</span>
          </Link>
        )
      })}
      <button onClick={onMore} className="flex-1 flex flex-col items-center justify-center gap-0.5 text-on-surface-variant">
        <Icon name="menu" /><span className="text-[10px]">Ще</span>
      </button>
    </nav>
  )
}
