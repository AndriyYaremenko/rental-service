# План 3d: Адаптивність (мобільна версія)

> **Для агентів:** ОБОВʼЯЗКОВИЙ СУБ-СКІЛ: `superpowers:subagent-driven-development`.
> Дизайн — макети `design/mobile-*.html` + ті самі токени/компоненти.

**Мета:** зробити застосунок придатним для телефона. Зараз фіксований `w-64`
сайдбар + `ml-64` виштовхує контент за екран на мобільних. Додаємо: мобільну
навігацію (гамбургер-drawer + нижня таб-панель), таблиці→картки, форми в одну
колонку. Десктоп лишається як є (`md:` брейкпоінт).

**Архітектура:** чисто клієнтський UI-рефактор (компоненти + Tailwind-брейкпоінти).
Бекенд не чіпаємо. Джерело дизайну — `design/mobile-dashboard.html`, `design/mobile-list.html`.

## Global Constraints

- Брейкпоінт `md` (768px): `<md` = мобільний (drawer + нижня навігація, картки,
  1 колонка); `md:` = десктоп (поточний сайдбар, таблиці, 2 колонки).
- Компоненти/сторінки НЕ юніт-тестуються (візуальна перевірка + `npm run build`).
  Уся логіка (`isActive`) — за потреби тестована. Свідома межа (як 3a-3c).
- Ті самі токени/компоненти; текст українською; TS ^6; коміти українською. Гілка від `main`.
- Нічого не ламаємо на десктопі (усі поточні екрани мають виглядати як раніше на `md:`).

## Структура файлів

| Файл | Зміна |
|---|---|
| `src/components/Sidebar.tsx` | + `NavList`/`isActive` (спільні), сайдбар `hidden md:flex` |
| `src/components/MobileNav.tsx` | NEW: `MobileDrawer` + `BottomNav` (`md:hidden`) |
| `src/components/TopBar.tsx` | + гамбургер (`md:hidden`), адаптивні паддінги |
| `src/components/AppShell.tsx` | `'use client'` + стан drawer, адаптивні `ml`/`pb` |
| `src/components/ui/DataTable.tsx` | таблиця `md:`, картки `<md` |
| форми + `PageHeader` + `Modal` | `grid-cols-1 sm:grid-cols-2`, стек хедера, `max-h` модалки |

---

### Task 1: Адаптивна оболонка (drawer + нижня навігація)

**Files:**
- Modify: `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/components/AppShell.tsx`
- Create: `src/components/MobileNav.tsx`

- [ ] **Step 1: Sidebar — винести спільне, зробити десктоп-онлі**

`src/components/Sidebar.tsx`:
```tsx
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
```
> Зміни: `hidden md:flex` (десктоп-онлі), винесено `NavList` + `isActive` для
> повторного використання в drawer/нижній навігації.

- [ ] **Step 2: MobileNav — drawer + нижня таб-панель**

`src/components/MobileNav.tsx`:
```tsx
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
```

- [ ] **Step 3: TopBar — гамбургер на мобільних**

`src/components/TopBar.tsx`:
```tsx
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
```

- [ ] **Step 4: AppShell — стан drawer + адаптивні відступи**

`src/components/AppShell.tsx`:
```tsx
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
```

- [ ] **Step 5: Перевірити** — `npm run build` компілюється; `npx vitest run` зелений.
Візуально (dev, звузити вікно до ~375px): сайдбар зникає, зʼявляється топбар із
гамбургером + нижня навігація; гамбургер відкриває drawer з 9 пунктами; клік по
пункту закриває drawer і навігує. На `md:` — усе як раніше (сайдбар, без нижньої навігації).

- [ ] **Step 6: Коміт**

```bash
git add src/components/Sidebar.tsx src/components/MobileNav.tsx src/components/TopBar.tsx src/components/AppShell.tsx
git commit -m "feat(ui): адаптивна оболонка — drawer + нижня навігація на мобільних

Сайдбар hidden md:flex; на <md — топбар із гамбургером (drawer на 9 пунктів) +
нижня таб-панель (4 швидкі + «Ще»). AppShell keeps desktop ml-64, mobile повна
ширина + pb під нижню навігацію. NavList/isActive винесено спільними."
```

---

### Task 2: DataTable — картки на мобільних

**Files:** Modify `src/components/ui/DataTable.tsx`.

- [ ] **Step 1: Реалізувати** (таблиця `md:`, картки `<md`, ті самі `columns`)

`src/components/ui/DataTable.tsx`:
```tsx
import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

function cell<T>(c: Column<T>, row: T): ReactNode {
  return c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')
}

export function DataTable<T extends { id?: string }>({ columns, rows, empty = 'Немає даних' }: { columns: Column<T>[]; rows: T[]; empty?: string }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-on-surface-variant text-body-md">{empty}</p>
  }
  return (
    <>
      {/* Десктоп: таблиця */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="text-on-surface-variant border-b border-surface-container">
              {columns.map((c) => (
                <th key={c.key} className={`py-3 text-label-md uppercase tracking-wider ${c.className ?? ''}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {rows.map((row, i) => (
              <tr key={row.id ?? i} className="hover:bg-surface-container-low transition-colors">
                {columns.map((c) => (
                  <td key={c.key} className={`py-4 text-body-md ${c.className ?? ''}`}>{cell(c, row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Мобільний: картки */}
      <div className="md:hidden space-y-2.5">
        {rows.map((row, i) => (
          <div key={row.id ?? i} className="rounded-lg border border-surface-container bg-surface-container-low p-3 divide-y divide-surface-container">
            {columns.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                {c.header
                  ? <><span className="text-label-md uppercase tracking-wider text-on-surface-variant shrink-0">{c.header}</span><span className="text-body-md text-right">{cell(c, row)}</span></>
                  : <span className="w-full flex justify-end">{cell(c, row)}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
```
> Порожній стан винесено з таблиці в спільний `<p>` (працює для обох). Колонки без
> заголовка (напр. дії edit/delete) у картці рендеряться без підпису, вирівняні праворуч.

- [ ] **Step 2: Перевірити** — build + suite; візуально <375px: списки — картки
(підпис колонки + значення), дії праворуч; на `md:` — таблиця як раніше.

- [ ] **Step 3: Коміт** — `git add src/components/ui/DataTable.tsx`;
`feat(ui): DataTable — картки на мобільних, таблиця на десктопі`.

---

### Task 3: Форми, PageHeader, Modal — адаптивність

**Files:** Modify form files + `src/components/PageHeader.tsx` + `src/components/ui/Modal.tsx`.

- [ ] **Step 1: Форми — 2 колонки лише на sm+**

У кожному файлі форми, де є `grid grid-cols-2 gap-4`, замінити на
`grid grid-cols-1 sm:grid-cols-2 gap-4`. Знайти всі входження:
```
grep -rl "grid-cols-2" src/app/\(app\) src/components
```
Файли-кандидати: `tenants/TenantForm.tsx`, `premises/PremisesForm.tsx`,
`leases/LeaseForm.tsx`, `payments/PaymentForm.tsx`, `settings/TariffForm.tsx`,
`settings/UserForm.tsx`. У КОЖНОМУ: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.
(На вузькому екрані поля стають одне під одним.)

- [ ] **Step 2: PageHeader — стек на мобільних**

`src/components/PageHeader.tsx`:
```tsx
import type { ReactNode } from 'react'

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-stack-lg">
      <h1 className="text-headline-md font-bold text-primary">{title}</h1>
      {action}
    </div>
  )
}
```

- [ ] **Step 3: Modal — прокрутка високих форм на мобільних**

У `src/components/ui/Modal.tsx` внутрішній контейнер картки: додати
`max-h-[90vh] overflow-y-auto` до класів панелі (`bg-surface-container-lowest
rounded-xl shadow-2xl p-card-padding w-full max-w-lg` → + `max-h-[90vh] overflow-y-auto`),
щоб довгі форми (договір, приміщення) прокручувались на телефоні. Решта Modal — без змін
(зокрема modalStack-логіка Escape).

- [ ] **Step 4: Перевірити** — build + suite; візуально <375px: поля форм у стовпчик,
хедер сторінки стекнутий (кнопка під заголовком), довга модалка прокручується.

- [ ] **Step 5: Коміт** — `git add` змінені файли;
`feat(ui): форми/хедер/модалка адаптивні (1 колонка, стек, прокрутка на мобільних)`.

---

### Task 4: Наскрізна перевірка + редеплой

- [ ] **Step 1:** `npx vitest run` (зелений) + `npm run build` (компілюється, усі маршрути).
- [ ] **Step 2: Ручна перевірка** (dev, DevTools device toolbar ~375px): навігація
(drawer+нижня), списки-картки, форми-стовпчик, дашборд-стек. Десктоп (>768px) — без регресій.
- [ ] **Step 3:** контролер робить редеплой (`git archive`→server build→restart rental)
і перевіряє на реальному телефоні / вузькому вікні.

---

## Підсумок

Після Task 4 застосунок адаптивний: мобільна навігація (drawer + нижня таб-панель),
таблиці→картки, форми в одну колонку — на телефоні; десктоп незмінний.

## Свідомі межі

- Компоненти не юніт-тестуються (візуальна перевірка + build). `isActive` — чиста,
  за потреби тестована.
- Масовий ввід показників (`/readings`) — широка таблиця; на мобільному лишається
  горизонтальний скрол (overflow-x-auto), не картки (ввід зручніший рядком). Прийнятно.
- Друк рахунку й логін уже адаптивні (центрована картка).
