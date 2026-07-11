'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './ui/Icon'

export const NAV_ITEMS = [
  { href: '/', label: 'Дашборд', icon: 'dashboard' },
  { href: '/premises', label: 'Приміщення', icon: 'domain' },
  { href: '/tenants', label: 'Орендарі', icon: 'groups' },
  { href: '/leases', label: 'Договори', icon: 'description' },
  { href: '/readings', label: 'Показники', icon: 'electric_bolt' },
  { href: '/invoices', label: 'Нарахування', icon: 'receipt_long' },
  { href: '/payments', label: 'Оплати', icon: 'payments' },
  { href: '/reports', label: 'Звіти', icon: 'bar_chart' },
  { href: '/settings', label: 'Налаштування', icon: 'settings' },
]

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 px-4 space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'text-secondary font-bold border-r-4 border-secondary' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'}`}>
            <Icon name={item.icon} /><span className="text-body-md">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-surface flex-col py-stack-lg z-50 hidden md:flex">
      <div className="px-6 mb-10">
        <h1 className="text-headline-sm font-bold text-primary">Облік Оренди</h1>
        <p className="text-on-surface-variant text-body-md">Комерційна нерухомість</p>
      </div>
      <NavList />
    </aside>
  )
}
