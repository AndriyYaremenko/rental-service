# План 3a: UI — оболонка, дизайн-система, логін, дашборд

> **Для агентів:** ОБОВʼЯЗКОВИЙ СУБ-СКІЛ: `superpowers:subagent-driven-development`.
> Кроки — чекбокси (`- [ ]`). Дизайн відтворюємо за макетами в `design/`.

**Мета:** підняти клієнтську частину — Tailwind 4 дизайн-систему (токени з макетів),
бібліотеку компонентів, оболонку (сайдбар+топбар), автентифікацію (логін+guard) і
дашборд із реальними даними. Перший із трьох UI-планів (3a→3b→3c).

**Архітектура:** Next 16 App Router. Клієнтські дані — **TanStack Query** над наявним
REST `/api` (сесія в httpOnly-cookie, вже реалізована). Сторінки/компоненти — тонка
презентація; логіка (API-клієнт, формат) — у тестованих утилітах. Дизайн — порт
макетів Stitch у `design/*.html` (навколишня система: наві/teal, Inter, 8px).

**Джерела дизайну (у репо):** `design/dashboard.html` (токени+оболонка+дашборд),
`design/login.html` (логін), `design/{locations-premises,readings,tenants}.html`
(для 3b/3c). 5 екранів без макета складаємо в тому ж стилі (спека §7.4) — це 3b/3c.

**Спека:** `docs/superpowers/specs/2026-07-10-rental-accounting-design.md` §7.
**Бекенд:** Плани 1–2c у `main`, не змінюються (UI лише споживає `/api`).

## Global Constraints

Діють у **кожній** задачі 3a.

- **Tailwind 4** — конфіг у CSS через `@theme` у `src/app/globals.css` (НЕ
  `tailwind.config.ts`). Токени портуються **дослівно** з `design/dashboard.html`
  (`<script id="tailwind-config">`): кольори, radius, spacing, fontSize.
- **Шрифти self-hosted через `next/font`** — Inter і Material Symbols Outlined;
  **жодних зовнішніх CDN** (спека §7.2). Прибрати `<script src="cdn.tailwindcss">`
  і `<link href="fonts.googleapis">` з портованої розмітки.
- **Уся текстівка — українською**; гроші форматуються `formatUah` (копійки→«1 234,56 грн»)
  з `@/domain/money`; площа — м². Англійські підписи макета («Equinox Management»,
  «Facility Operations» тощо) → українські («Облік Комерційної Оренди»).
- **Дані — TanStack Query над `/api`.** Ніяких прямих `prisma`/сервер-функцій у
  клієнті. Типи DTO — з відповідних сервісів (`import type`) або локальні дублікати.
- **Гроші — рядки/числа з DTO**, ніколи не конструюються в UI. Статуси — з DTO
  (обчислені бекендом).
- **Логіка — тестується (Vitest, node-env, вже налаштований); презентація — ні.**
  API-клієнт і формат-хелпери мають тести; React-компоненти/сторінки НЕ
  юніт-тестуються (тонка обгортка над дизайном; перевіряються `npm run build` +
  візуально). Це свідома межа, як route-handler'и в Планах 2a-c.
- TypeScript ^6 (НЕ 7 — ламає `next build`). Ідентифікатори англійською; коміти українською.
- Компоненти — у `src/components/`; UI-примітиви — `src/components/ui/`.

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `src/app/globals.css` | `@theme` токени + dark-варіант |
| `src/app/layout.tsx` | root layout: lang="uk", шрифти, Providers |
| `src/app/providers.tsx` | `'use client'` QueryClientProvider |
| `src/lib/api.ts` | `apiFetch` — обгортка над `/api` з розбором envelope |
| `src/lib/format.ts` | ре-експорт `formatUah` + дрібні UI-формати (дата) |
| `src/hooks/auth.ts` | `useMe`, `useLogin`, `useLogout` |
| `src/components/ui/*` | Icon, Button, Input, Card, StatusChip, DataTable, KpiCard |
| `src/components/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx` | оболонка |
| `src/app/login/page.tsx` | сторінка логіну |
| `src/app/(app)/layout.tsx` | захищений layout з оболонкою |
| `src/app/(app)/page.tsx` | дашборд |
| `tests/lib/*.test.ts` | тести API-клієнта й форматів |

---

### Task 1: Залежності, шрифти, провайдери, root layout

**Files:**
- Modify: `package.json` (dep), `src/app/layout.tsx`
- Create: `src/app/providers.tsx`
- Test: (візуальний — `npm run dev` рендерить без помилок)

**Interfaces:**
- Produces: `Providers` (client) обгортка з `QueryClientProvider`; root layout з
  self-hosted Inter + Material Symbols і `lang="uk"`.

- [ ] **Step 1: Встановити TanStack Query**

Run: `npm install @tanstack/react-query`
Expected: додано в `dependencies`.

- [ ] **Step 2: Провайдери**

`src/app/providers.tsx`:
```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

- [ ] **Step 3: Root layout зі self-hosted шрифтами**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter, Material_Symbols_Outlined } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'], weight: ['400', '600', '700'], variable: '--font-inter' })
const symbols = Material_Symbols_Outlined({ weight: ['400'], variable: '--font-symbols', display: 'block' })

export const metadata: Metadata = {
  title: 'Облік Комерційної Оренди',
  description: 'Облік комерційної оренди й комунальних послуг',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${inter.variable} ${symbols.variable}`}>
      <body className="bg-surface text-on-surface min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

> `next/font/google` завантажує шрифти на етапі збірки (self-hosted, без рантайм-CDN)
> — відповідає §7.2. Якщо `Material_Symbols_Outlined` недоступний як експорт у
> версії `next/font`, перевір точну назву в RED; альтернатива — `localFont` із
> завантаженим `.woff2`. Cyrillic subset обовʼязковий (українська).

- [ ] **Step 4: Перевірити**

Run: `npm run dev` → відкрити `/`; сторінка рендериться без помилок консолі
(поки що плейсхолдер `page.tsx`). `npm run build` компілюється.

- [ ] **Step 5: Коміт**

```bash
git add package.json package-lock.json src/app/layout.tsx src/app/providers.tsx
git commit -m "feat(ui): TanStack Query, self-hosted шрифти, root layout

Inter + Material Symbols через next/font (self-hosted, без CDN, §7.2). lang=uk.
QueryClientProvider для клієнтських даних над REST /api."
```

---

### Task 2: Дизайн-токени → Tailwind 4 `@theme`

**Files:**
- Modify: `src/app/globals.css`
- Test: візуальний (тестова розмітка з `bg-primary`, `text-secondary` тощо)

**Interfaces:**
- Produces: усі кольори/radius/spacing/розміри тексту з `design/dashboard.html`
  як Tailwind-утиліти (`bg-primary`, `text-on-surface-variant`, `rounded-xl`,
  `p-card-padding`, `text-display-lg`, `text-label-md`…).

- [ ] **Step 1: Прочитати токени з макета**

Відкрий `design/dashboard.html`, блок `<script id="tailwind-config">`. Перенеси
**дослівно** значення `colors`, `borderRadius`, `spacing`, `fontSize`.

- [ ] **Step 2: Записати `@theme`**

`src/app/globals.css` (Tailwind 4 — кожен токен як CSS-змінна у `@theme`):
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Кольори (з design/dashboard.html tailwind.config.colors) */
  --color-primary: #041627;
  --color-primary-container: #1a2b3c;
  --color-on-primary: #ffffff;
  --color-on-primary-container: #8192a7;
  --color-secondary: #006a6a;
  --color-on-secondary: #ffffff;
  --color-secondary-container: #96efee;
  --color-on-secondary-container: #006e6e;
  --color-tertiary: #0f161b;
  --color-tertiary-fixed: #dde3eb;
  --color-error: #ba1a1a;
  --color-on-error: #ffffff;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;
  --color-surface: #f8f9ff;
  --color-surface-bright: #f8f9ff;
  --color-surface-dim: #cbdbf5;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #eff4ff;
  --color-surface-container: #e5eeff;
  --color-surface-container-high: #dce9ff;
  --color-surface-container-highest: #d3e4fe;
  --color-surface-variant: #d3e4fe;
  --color-on-surface: #0b1c30;
  --color-on-surface-variant: #44474c;
  --color-background: #f8f9ff;
  --color-on-background: #0b1c30;
  --color-outline: #74777d;
  --color-outline-variant: #c4c6cd;
  --color-primary-fixed: #d2e4fb;
  --color-primary-fixed-dim: #b7c8de;
  --color-inverse-primary: #b7c8de;
  --color-inverse-surface: #213145;
  --color-inverse-on-surface: #eaf1ff;

  /* Радіуси */
  --radius: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;

  /* Spacing (додаткові семантичні кроки) */
  --spacing-unit: 8px;
  --spacing-stack-sm: 8px;
  --spacing-stack-md: 16px;
  --spacing-stack-lg: 32px;
  --spacing-gutter: 24px;
  --spacing-card-padding: 24px;
  --spacing-container-margin: 32px;

  /* Типографіка */
  --font-sans: var(--font-inter), sans-serif;
  --text-display-lg: 32px;
  --text-display-lg--line-height: 40px;
  --text-display-lg--font-weight: 700;
  --text-headline-md: 24px;
  --text-headline-md--line-height: 32px;
  --text-headline-md--font-weight: 600;
  --text-headline-sm: 20px;
  --text-headline-sm--line-height: 28px;
  --text-headline-sm--font-weight: 600;
  --text-body-lg: 16px;
  --text-body-lg--line-height: 24px;
  --text-body-md: 14px;
  --text-body-md--line-height: 20px;
  --text-label-md: 12px;
  --text-label-md--line-height: 16px;
  --text-label-md--font-weight: 600;
  --text-label-md--letter-spacing: 0.05em;
}

/* Material Symbols базовий клас */
.material-symbols-outlined {
  font-family: var(--font-symbols);
  font-weight: normal;
  font-style: normal;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}
```

> У портованій розмітці макета клас `font-{role}` (сімейство, усюди Inter) —
> надлишковий: базовий шрифт уже Inter. Досить `text-{role}` (розмір). При
> порті замінюй `font-headline-sm text-headline-sm` → `text-headline-sm`.
> Точні назви токенів звір із макетом (RED: якщо `bg-surface-container` не
> застосовується — перевір назву змінної).

- [ ] **Step 3: Перевірити**

Тимчасово встав у `src/app/page.tsx` блок із `class="bg-primary text-on-primary
p-card-padding rounded-xl text-display-lg"` → `npm run dev`: наві-фон, білий
текст, великий розмір, заокруглення 12px. Прибери після перевірки. `npm run build` ок.

- [ ] **Step 4: Коміт**

```bash
git add src/app/globals.css
git commit -m "feat(ui): дизайн-токени Stitch → Tailwind 4 @theme

Кольори/radius/spacing/типографіка дослівно з design/dashboard.html. Dark-варіант
через @custom-variant. Material Symbols базовий клас."
```

---

### Task 3: UI-примітиви (Icon, Button, Input, Card, StatusChip)

**Files:**
- Create: `src/components/ui/{Icon,Button,Input,Card,StatusChip}.tsx`
- Test: `tests/components/status-chip.test.ts` (лише чиста логіка мапінгу статусу)

**Interfaces:**
- Produces:
  - `Icon({ name, className? })` — `<span className="material-symbols-outlined">{name}</span>`
  - `Button({ variant: 'navy'|'ghost'|'teal', ... })` — за макетом (naвi bg-primary,
    ghost border, teal bg-secondary), `rounded-lg`
  - `Input({ label?, icon?, error?, ... })` — `rounded-lg`, focus teal ring (за макетом логіну)
  - `Card({ children, className? })` — `bg-surface-container-lowest rounded-xl shadow p-card-padding border border-surface-container`
  - `StatusChip({ status })` + чиста `chipClass(status)` — pill за макетом

- [ ] **Step 1: Написати падаючий тест (лише мапінг статусу)**

`tests/components/status-chip.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { chipClass, STATUS_LABEL } from '@/components/ui/StatusChip'

describe('StatusChip мапінг', () => {
  it('кожен статус має свій клас і український підпис', () => {
    expect(STATUS_LABEL.PAID).toBe('Оплачено')
    expect(STATUS_LABEL.PARTIAL).toBe('Частково')
    expect(STATUS_LABEL.UNPAID).toBe('Не оплачено')
    expect(STATUS_LABEL.ACTIVE).toBe('Активний')
    expect(STATUS_LABEL.ENDED).toBe('Завершений')
    // різні статуси → різні класи (не всі однакові)
    expect(chipClass('PAID')).not.toBe(chipClass('UNPAID'))
  })
})
```

- [ ] **Step 2: Запустити — впасти**

Run: `npx vitest run tests/components/status-chip.test.ts`
Expected: FAIL — `Cannot find module '@/components/ui/StatusChip'`

- [ ] **Step 3: Реалізувати примітиви**

`src/components/ui/Icon.tsx`:
```tsx
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden>{name}</span>
}
```

`src/components/ui/StatusChip.tsx` (класи pill за макетом; логіка — чиста, тестована):
```tsx
export type ChipStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'ACTIVE' | 'ENDED'

export const STATUS_LABEL: Record<ChipStatus, string> = {
  PAID: 'Оплачено', PARTIAL: 'Частково', UNPAID: 'Не оплачено',
  ACTIVE: 'Активний', ENDED: 'Завершений',
}

const BASE = 'px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-tighter'
export function chipClass(status: ChipStatus): string {
  const tone: Record<ChipStatus, string> = {
    PAID: 'bg-secondary-container text-on-secondary-container',
    ACTIVE: 'bg-secondary-container text-on-secondary-container',
    PARTIAL: 'bg-primary-fixed text-primary-container',
    UNPAID: 'bg-error-container text-on-error-container',
    ENDED: 'bg-surface-container-highest text-on-surface-variant',
  }
  return `${BASE} ${tone[status]}`
}

export function StatusChip({ status }: { status: ChipStatus }) {
  return <span className={chipClass(status)}>{STATUS_LABEL[status]}</span>
}
```

`src/components/ui/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'navy' | 'ghost' | 'teal'
const VARIANT: Record<Variant, string> = {
  navy: 'bg-primary text-on-primary hover:opacity-90',
  ghost: 'border-2 border-primary text-primary hover:bg-primary hover:text-on-primary',
  teal: 'bg-secondary text-white hover:scale-105',
}
export function Button({ variant = 'navy', className = '', ...props }: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`px-6 py-3 rounded-lg font-bold text-body-md transition-all disabled:opacity-50 ${VARIANT[variant]} ${className}`} {...props} />
}
```

`src/components/ui/Input.tsx`:
```tsx
import type { InputHTMLAttributes } from 'react'

export function Input({ label, error, className = '', ...props }: { label?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label && <span className="block text-label-md uppercase tracking-wider text-on-surface-variant mb-1">{label}</span>}
      <input className={`w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/40 outline-none transition-all ${error ? 'border-error' : ''} ${className}`} {...props} />
      {error && <span className="block text-body-md text-error mt-1">{error}</span>}
    </label>
  )
}
```

`src/components/ui/Card.tsx`:
```tsx
import type { ReactNode } from 'react'
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container ${className}`}>{children}</div>
}
```

- [ ] **Step 4: Запустити — пройти**

Run: `npx vitest run tests/components/status-chip.test.ts` → PASS. `npm run build` ок.

- [ ] **Step 5: Коміт**

```bash
git add src/components/ui tests/components/status-chip.test.ts
git commit -m "feat(ui): примітиви — Icon, Button, Input, Card, StatusChip

Класи з макетів Stitch (navy/ghost/teal кнопки, pill-чіпи, картки rounded-xl).
Мапінг статусу → колір+український підпис — чиста тестована функція."
```

---

### Task 4: DataTable і KpiCard

**Files:**
- Create: `src/components/ui/DataTable.tsx`, `src/components/ui/KpiCard.tsx`
- Test: (візуальний)

**Interfaces:**
- Produces:
  - `DataTable<T>({ columns, rows, empty? })` — безбордерна таблиця за макетом
    (thead uppercase label-md, tbody divide-y, hover). `columns: { key; header;
    render?; className? }[]`.
  - `KpiCard({ label, value, delta?, icon, iconTone? })` — за макетом дашборду.

- [ ] **Step 1: Реалізувати** (презентаційні; порт із `design/dashboard.html`)

`src/components/ui/DataTable.tsx`:
```tsx
import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

export function DataTable<T extends { id?: string }>({ columns, rows, empty = 'Немає даних' }: { columns: Column<T>[]; rows: T[]; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-on-surface-variant border-b border-surface-container">
            {columns.map((c) => (
              <th key={c.key} className={`py-3 text-label-md uppercase tracking-wider ${c.className ?? ''}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-8 text-center text-on-surface-variant text-body-md">{empty}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={row.id ?? i} className="hover:bg-surface-container-low transition-colors">
              {columns.map((c) => (
                <td key={c.key} className={`py-4 text-body-md ${c.className ?? ''}`}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

`src/components/ui/KpiCard.tsx`:
```tsx
import { Icon } from './Icon'

export function KpiCard({ label, value, delta, icon, iconTone = 'primary' }: { label: string; value: string; delta?: { text: string; positive?: boolean }; icon: string; iconTone?: 'primary' | 'secondary' }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container">
      <div className="flex justify-between items-start mb-2">
        <span className="text-on-surface-variant text-label-md uppercase tracking-widest">{label}</span>
        <div className={`p-2 rounded-lg ${iconTone === 'secondary' ? 'bg-secondary-container text-secondary' : 'bg-primary-fixed text-primary'}`}><Icon name={icon} /></div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-display-lg text-primary font-bold">{value}</span>
        {delta && <span className={`font-bold text-body-md ${delta.positive ? 'text-secondary' : 'text-error'}`}>{delta.text}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Перевірити** — `npm run build` компілюється (типи дженериків DataTable ок).

- [ ] **Step 3: Коміт**

```bash
git add src/components/ui/DataTable.tsx src/components/ui/KpiCard.tsx
git commit -m "feat(ui): DataTable і KpiCard за макетом дашборду

Безбордерна таблиця (uppercase-заголовки, divide-y, hover, порожній стан),
KPI-картка з іконкою й дельтою. Дженерик DataTable<T> із колонками-рендерами."
```

---

### Task 5: Оболонка — Sidebar, TopBar, AppShell

**Files:**
- Create: `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/components/AppShell.tsx`
- Test: (візуальний; активний пункт — `usePathname`)

**Interfaces:**
- Consumes: `Icon`, `useMe`/`useLogout` (Task 6 — якщо ще нема, TopBar приймає
  `user`/`onLogout` як пропси, підключення в (app)/layout Task 6/8)
- Produces:
  - `NAV_ITEMS` — 9 пунктів `{ href, label, icon }`
  - `Sidebar()` — фіксований w-64, активний пункт за `usePathname`
  - `TopBar({ title, user, onLogout })`
  - `AppShell({ title, children })` — компонує Sidebar + TopBar + `<main>`

- [ ] **Step 1: Реалізувати**

`src/components/Sidebar.tsx` (порт із `design/dashboard.html` `<aside>`; підписи —
українські; активний — teal текст + `border-r-4 border-secondary`):
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

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-surface flex flex-col py-stack-lg z-50">
      <div className="px-6 mb-10">
        <h1 className="text-headline-sm font-bold text-primary">Облік Оренди</h1>
        <p className="text-on-surface-variant text-body-md">Комерційна нерухомість</p>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'text-secondary font-bold border-r-4 border-secondary' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'}`}>
              <Icon name={item.icon} />
              <span className="text-body-md">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

`src/components/TopBar.tsx`:
```tsx
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
```

> `import type { SessionUser }` — лише тип, не рантайм-код (сервер-модуль не
> потрапляє в клієнтський бандл). Якщо збірка свариться — продублюй тип локально
> `{ name: string; role: 'ADMIN' | 'USER' }`.

`src/components/AppShell.tsx`:
```tsx
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
```

- [ ] **Step 2: Перевірити** — `npm run build` ок; типи `SessionUser` імпортуються як тип.

- [ ] **Step 3: Коміт**

```bash
git add src/components/Sidebar.tsx src/components/TopBar.tsx src/components/AppShell.tsx
git commit -m "feat(ui): оболонка — сайдбар (9 пунктів), топбар, AppShell

Порт із макета: фіксований w-64 сайдбар, активний пункт teal+border за usePathname,
sticky топбар із користувачем і виходом. Українські підписи навігації."
```

---

### Task 6: API-клієнт і хуки автентифікації

**Files:**
- Create: `src/lib/api.ts`, `src/hooks/auth.ts`
- Test: `tests/lib/api.test.ts`

**Interfaces:**
- Consumes: `SessionUser` (тип); `@tanstack/react-query`
- Produces:
  - `class ApiError { code; message; fields? }` (клієнтський) + `apiFetch<T>(path, init?): Promise<T>`
    — кидає `ApiError` з розібраного envelope `{ error: { code, message, fields? } }`
  - `useMe()` (query `/api/auth/me`), `useLogin()` (mutation), `useLogout()` (mutation)

- [ ] **Step 1: Написати падаючий тест (логіка API-клієнта)**

`tests/lib/api.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ClientApiError } from '@/lib/api'

afterEach(() => vi.restoreAllMocks())
const mockFetch = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })))

describe('apiFetch', () => {
  it('повертає розпарсене тіло на 2xx', async () => {
    mockFetch(200, { id: '1', name: 'Іван' })
    expect(await apiFetch('/api/x')).toEqual({ id: '1', name: 'Іван' })
  })

  it('кидає ClientApiError із кодом і полями на помилку', async () => {
    mockFetch(400, { error: { code: 'VALIDATION_FAILED', message: 'Погано', fields: { email: 'Обовʼязкове' } } })
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { email: 'Обовʼязкове' } })
  })

  it('кидає ClientApiError навіть коли тіло не JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })))
    await expect(apiFetch('/api/x')).rejects.toBeInstanceOf(ClientApiError)
  })
})
```

- [ ] **Step 2: Запустити — впасти**

Run: `npx vitest run tests/lib/api.test.ts`
Expected: FAIL — `Cannot find module '@/lib/api'`

- [ ] **Step 3: Реалізувати**

`src/lib/api.ts`:
```ts
export class ClientApiError extends Error {
  constructor(readonly code: string, message: string, readonly fields?: Record<string, string>) {
    super(message)
  }
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (res.ok) {
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }
  let code = 'INTERNAL', message = 'Помилка сервера', fields: Record<string, string> | undefined
  try {
    const body = await res.json()
    if (body?.error) { code = body.error.code ?? code; message = body.error.message ?? message; fields = body.error.fields }
  } catch { /* не JSON — лишаємо дефолт */ }
  throw new ClientApiError(code, message, fields)
}
```

`src/hooks/auth.ts`:
```ts
'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { SessionUser } from '@/server/auth/core'

export function useMe() {
  return useQuery<SessionUser>({ queryKey: ['me'], queryFn: () => apiFetch<SessionUser>('/api/auth/me') })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<SessionUser>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (user) => qc.setQueryData(['me'], user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.setQueryData(['me'], null),
  })
}
```

- [ ] **Step 4: Запустити — пройти**

Run: `npx vitest run tests/lib/api.test.ts` → 3 passed. `npm run build` ок.

- [ ] **Step 5: Коміт**

```bash
git add src/lib/api.ts src/hooks/auth.ts tests/lib/api.test.ts
git commit -m "feat(ui): API-клієнт (розбір envelope) і auth-хуки

apiFetch кидає ClientApiError із code/message/fields (навіть на не-JSON тіло).
useMe/useLogin/useLogout над /api/auth через TanStack Query."
```

---

### Task 7: Сторінка логіну

**Files:**
- Create: `src/app/login/page.tsx`
- Test: (візуальний + порт `design/login.html`)

**Interfaces:**
- Consumes: `useLogin`, `Input`, `Button`, `Card`, `ClientApiError`

- [ ] **Step 1: Реалізувати** (порт `design/login.html`; форма → `useLogin`)

`src/app/login/page.tsx`:
```tsx
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
```

> Макет має «Забули пароль?» / соц-вхід — НЕ портуємо (немає бекенду; поза скоупом).
> Будь-яка помилка логіну показується як «Невірний email або пароль» (бекенд не
> розкриває, який email існує — §3 no-enumeration; не показуй `login.error.message`).

- [ ] **Step 2: Перевірити** — `npm run dev`, `/login` рендериться за макетом; невірні
дані → повідомлення; вірні (seed `admin@rent.ksm.in.ua`/`admin12345`) → редірект `/`.
`npm run build` ок.

- [ ] **Step 3: Коміт**

```bash
git add src/app/login/page.tsx
git commit -m "feat(ui): сторінка логіну

Порт design/login.html: центрована картка, Email+Пароль, кнопка «Увійти».
useLogin → редірект на дашборд. Помилка — узагальнена (no-enumeration §3)."
```

---

### Task 8: Захищений layout і дашборд

**Files:**
- Create: `src/middleware.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`
- Delete: `src/app/page.tsx` (переїжджає в `(app)/page.tsx`)
- Test: (візуальний)

**Interfaces:**
- Consumes: `AppShell`, `useMe`, `useLogout`, `apiFetch`, `KpiCard`, `Card`,
  `DataTable`, `formatUah`, DTO-типи

- [ ] **Step 1: Middleware — редірект на логін без сесії**

`src/middleware.ts` (проста перевірка присутності cookie; повна валідація — у `/api`):
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/session'

export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value)
  const isLogin = req.nextUrl.pathname === '/login'
  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
}

export const config = {
  // усе, крім api, статики, логіну-ассетів
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
}
```
> Cookie-присутність — лише UX-редірект; справжня авторизація лишається на `/api`
> (guard `requireUser` перевіряє підпис і `isActive` щоразу). Точний matcher звір
> у RED: `/login` має бути доступний без сесії.

- [ ] **Step 2: Захищений layout з оболонкою**

`src/app/(app)/layout.tsx`:
```tsx
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
```

- [ ] **Step 3: Дашборд** (порт `design/dashboard.html`; реальні дані з `/api`)

`src/app/(app)/page.tsx`:
```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { KpiCard } from '@/components/ui/KpiCard'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusChip } from '@/components/ui/StatusChip'
import { formatUah } from '@/domain/money'

interface TenantDTO { id: string }
interface PremisesDTO { id: string; occupied: boolean }
interface InvoiceDTO { id: string; leaseId: string; totalKop: number; status: 'UNPAID' | 'PARTIAL' | 'PAID' }

const now = new Date()
const Y = now.getUTCFullYear(), M = now.getUTCMonth() + 1

export default function DashboardPage() {
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: () => apiFetch<TenantDTO[]>('/api/tenants') })
  const premises = useQuery({ queryKey: ['premises'], queryFn: () => apiFetch<PremisesDTO[]>('/api/premises') })
  const invoices = useQuery({ queryKey: ['invoices', Y, M], queryFn: () => apiFetch<InvoiceDTO[]>(`/api/invoices?year=${Y}&month=${M}`) })

  const tenantCount = tenants.data?.length ?? 0
  const occ = premises.data ? Math.round((premises.data.filter((p) => p.occupied).length / Math.max(premises.data.length, 1)) * 100) : 0
  const monthTotalKop = invoices.data?.reduce((s, i) => s + i.totalKop, 0) ?? 0

  const cols: Column<InvoiceDTO>[] = [
    { key: 'leaseId', header: 'Договір', render: (r) => <span className="text-primary font-bold">{r.leaseId.slice(0, 8)}</span> },
    { key: 'totalKop', header: 'Сума', render: (r) => formatUah(r.totalKop) },
    { key: 'status', header: 'Статус', render: (r) => <StatusChip status={r.status} /> },
  ]

  return (
    <div className="space-y-stack-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <KpiCard label="Орендарі" value={String(tenantCount)} icon="groups" iconTone="primary" />
        <KpiCard label="Заповненість" value={`${occ}%`} icon="home_work" iconTone="secondary" />
        <KpiCard label="Нараховано за місяць" value={formatUah(monthTotalKop)} icon="payments" iconTone="primary" />
      </div>
      <Card>
        <h3 className="text-headline-sm text-primary mb-6">Нарахування цього місяця</h3>
        <DataTable columns={cols} rows={invoices.data ?? []} empty="Нарахувань за місяць ще немає" />
      </Card>
    </div>
  )
}
```

> Дашборд-макет має графіки/«renewals» на фейкових даних — спрощуємо до реальних
> метрик, доступних через `/api` (орендарі, заповненість, нарахування місяця).
> Точні поля DTO (`occupied` у premises, `status`/`totalKop` в invoices) звір із
> сервісами; якщо `occupied` зветься інакше — виправ.

- [ ] **Step 4: Перевірити наскрізно**

`npm run dev`: без сесії будь-який шлях → `/login`; вхід seed-адміном → дашборд із
реальними KPI й таблицею; сайдбар-навігація активна; вихід → `/login`.
`npm run build` компілюється; `npx vitest run` — усі тести зелені.

- [ ] **Step 5: Коміт**

```bash
git add src/middleware.ts "src/app/(app)" tests
git rm src/app/page.tsx
git commit -m "feat(ui): захищений layout, middleware-редірект, дашборд

middleware редіректить без сесії на /login (справжня авторизація лишається в /api).
(app)/layout — оболонка з useMe/useLogout. Дашборд: реальні KPI (орендарі,
заповненість, нарахування місяця) і таблиця нарахувань замість фейкових даних."
```

---

## Підсумок плану

Після Task 8 працює каркас UI:
- Tailwind 4 дизайн-система з токенів макета; self-hosted Inter/Material Symbols;
- бібліотека компонентів (Icon, Button, Input, Card, StatusChip, DataTable, KpiCard);
- оболонка (сайдбар 9 пунктів, топбар) із похідним активним станом;
- автентифікація: логін, guard-редірект, вихід;
- дашборд на реальних даних `/api`.

Наступні плани: **3b** — довідкові CRUD-екрани (приміщення/локації/орендарі/тарифи/
користувачі) з формами-модалками; **3c** — грошові екрани (договори/показники/
нарахування/оплати/звіти) + друк рахунку + CSRF-токен.

## Свідомі межі (для рев'ю)

- React-компоненти/сторінки НЕ юніт-тестуються (тонка презентація; перевірка —
  `npm run build` типізацією + візуально). Тестуються ЛИШЕ чисті утиліти
  (`apiFetch`, мапінг статусу). Узгоджено з філософією Планів 2a-c (тест логіки,
  не glue). Якщо потрібні e2e — окремо (Playwright) у майбутньому плані.
- Middleware робить лише UX-редірект за присутністю cookie; криптоперевірка й
  `isActive` — на кожному `/api` через `requireUser`. Це не діра: без валідного
  підпису жоден `/api` не віддасть даних.
- Дашборд-метрики спрощено до наявних `/api` (немає окремого dashboard-endpoint;
  агрегація на клієнті). Виділений endpoint — кандидат на майбутнє, якщо потрібно.
- CSRF-токен — у Плані 3c (там зʼявляться клієнтські грошові мутації). `SameSite=lax`
  досі базово захищає.
