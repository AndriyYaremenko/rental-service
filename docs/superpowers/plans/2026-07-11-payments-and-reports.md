# План 2c: Оплати та звіти (оплати → борги → місячний → історія → CSV)

> **Для агентів:** ОБОВʼЯЗКОВИЙ СУБ-СКІЛ: `superpowers:subagent-driven-development`
> (рекомендовано) або `superpowers:executing-plans`. Кроки — чекбокси (`- [ ]`).

**Мета:** замкнути грошовий ланцюг — записати оплати (CRUD), вивести борги/аванси,
місячний звіт і історію приміщення, віддати експорт CSV. Уся арифметика — вже
готові доменні функції (`debtKop`, `advanceKop`, `allocatePayments`, `fromKop`);
цей план — тонке service+API-обгортання над ними.

**Архітектура:** патерн Планів 2a/2b — тонкі route-handler'и над тестованими
service-функціями. Гроші — цілі копійки; вхід у грн конвертується `toKop` на межі.
Жодного нового доменного модуля: борг/аванс/статуси беруться з `src/domain/`
(`debt.ts`, `allocation.ts`, `money.ts`), які вже під тестами Плану 1. Звіти
переиспользують `listInvoices` (Task 6 Плану 2b), де це DRY.

**Спека:** `docs/superpowers/specs/2026-07-10-rental-accounting-design.md`
(§5.6 FIFO/борг, §6 API, §9 наскрізний ланцюг). **Плани 1, 2a, 2b** — у `main`,
не змінюються.

Це четвертий (останній API-) план. Наступний — **План 3: UI** (порт дизайну Stitch,
CSRF-токен — там зʼявиться клієнт, що його відсилатиме).

## Global Constraints

Успадковані з Планів 2a/2b, діють у **кожній** задачі.

- **Гроші — цілі копійки (`Int`).** У DTO суми — `number` копійок; вхід у грн
  конвертується через `toKop` на межі сервісу (помилка `InvalidAmountError` →
  `ApiError('VALIDATION_FAILED')`, не 500). `Decimal` — рядок; `Date` — ISO-рядок.
- **Формат помилки за §6.1** (envelope із `@/server/http`). Коди: `NOT_FOUND` 404,
  `VALIDATION_FAILED` 400, `CONFLICT` 409 (напр. видалення при `onDelete: Restrict`).
- **Уся логіка — у service; route-handler'и тонкі** (`await requireUser()` → parse →
  service → json/Response), юніт-тестами не покриваються (перевіряються `npm run build`).
- **Мандаторні тести кожної CRUD-задачі:** **get/update/delete** неіснуючого id →
  `NOT_FOUND` (усі три); форма DTO (`Object.keys().sort()` — без витоку полів БД);
  форма елемента `listX()`; де є clearable-поле — персистенція **явного `null`**
  (подавай `null` у сервіс, НЕ `''` — трансформа `''`→null живе в `optionalText`
  у Zod-схемі, а service-тести минають Zod; тест на `''`→null пиши на рівні схеми,
  не сервісу — урок Плану 2a Task 4); де вхід — сума в грн — некоректна сума →
  `VALIDATION_FAILED` (не 500). Кожна експортована функція має тест.
- **Teardown НІКОЛИ не викликає `deleteMany` з можливо-`undefined` фільтром id.**
  Тести бʼють по seed-`dev.db` (окремої тестової БД немає), а Prisma тлумачить
  `{ where: { leaseId: undefined } }` як «без фільтра» → знесе ВСЮ таблицю. Якщо
  тест не створює фікстур (напр. `getX('немає') → NOT_FOUND`), гварди `if (ids.x)`
  або фільтруй `{ in: [...].filter(Boolean) }`, або прибирай за створеною сутністю.
- **Ізоляція від seed у глобальних сервісах:** звіти агрегують УСЮ БД (як
  `generateInvoices`). Тести-звіти використовують рік **2029** (seed заповнює 2026,
  а seed-договори у 2029 не мають показників → не створюють рахунків) і прибирають
  за власною локацією.
- Типи Prisma — з `@/generated/prisma/client` (`Prisma.PaymentModel`); `prisma` —
  з `@/server/db`. Ідентифікатори англійською; повідомлення й коміти українською.
- **TDD обовʼязковий** для service. Не оновлювати TypeScript до 7, схему не чіпати.
- **CSRF відкладено до Плану 3** (клієнт має відсилати токен; `SameSite=lax` уже
  блокує міжсайтові мутації). У 2c не робимо.

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `src/lib/validation/payment.ts` | Zod: створення/оновлення оплати |
| `src/server/services/payments.ts` | CRUD оплат, грн→копійки, метод-enum |
| `src/app/api/payments/route.ts`, `[id]/route.ts` | тонкі роути оплат |
| `src/server/services/reports.ts` | борги, місячний, історія приміщення |
| `src/app/api/reports/debts/route.ts` | GET борги |
| `src/app/api/reports/monthly/route.ts` | GET місячний (`parseYearMonth`) |
| `src/app/api/reports/premises/[id]/route.ts` | GET історія приміщення |
| `src/server/csv.ts` | чиста серіалізація CSV (RFC 4180 + BOM) |
| `src/app/api/reports/export/route.ts` | GET експорт `text/csv` |
| `tests/services/payments.test.ts`, `reports.test.ts`, `tests/server/csv.test.ts`, `tests/services/chain-e2e.test.ts` | тести |

---

### Task 1: Оплати (CRUD)

**Files:**
- Create: `src/lib/validation/payment.ts`, `src/server/services/payments.ts`
- Create: `src/app/api/payments/route.ts`, `src/app/api/payments/[id]/route.ts`
- Test: `tests/services/payments.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError` з `@/server/http`, `toKop` з `@/domain/money`,
  `InvalidAmountError` з `@/domain/errors`, `optionalText`/`trimmed` з `@/lib/validation/common`
- Produces:
  - `interface PaymentDTO { id; leaseId; date: string; amountKop: number; method: 'CASH' | 'CARD' | 'BANK'; note: string | null }`
  - `listPayments(leaseId?: string): Promise<PaymentDTO[]>`
  - `getPayment(id): Promise<PaymentDTO>`, `createPayment(data: PaymentCreate): Promise<PaymentDTO>`,
    `updatePayment(id, data: PaymentUpdate): Promise<PaymentDTO>`, `deletePayment(id): Promise<void>`

- [ ] **Step 1: Написати падаючі тести**

`tests/services/payments.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createPayment, deletePayment, getPayment, listPayments, updatePayment } from '@/server/services/payments'
import { prisma } from '@/server/db'

let ids: Record<string, string> = {}
afterEach(async () => {
  if (ids.lease) {
    await prisma.payment.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.lease.deleteMany({ where: { id: ids.lease } })
    await prisma.premises.deleteMany({ where: { id: ids.prem } })
    await prisma.tenant.deleteMany({ where: { id: ids.ten } })
    await prisma.location.deleteMany({ where: { name: 'Оплата' } })
  }
  ids = {}
})

async function lease() {
  const loc = await prisma.location.create({ data: { name: 'Оплата', address: 'вул. О, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'P1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар О' } })
  const l = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: 1, garbageKop: 0 } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: l.id }
  return l.id
}

describe('payments service', () => {
  it('створює оплату; грн → копійки, дата ISO, note зберігається', async () => {
    const leaseId = await lease()
    // Service-тести минають Zod, тож note подаємо ВЖЕ чистим (трім/''→null — робота
    // optionalText у схемі, на межі роуту, не сервісу; див. урок Плану 2a Task 4).
    const p = await createPayment({ leaseId, date: '2029-06-15', amountUah: '5000.50', method: 'CASH', note: 'за червень' })
    expect(p.amountKop).toBe(500_050)
    expect(p.date).toContain('2029-06-15')
    expect(p.method).toBe('CASH')
    expect(p.note).toBe('за червень')
  })

  it('явний null у note очищає його (персистенція явного null)', async () => {
    const leaseId = await lease()
    const created = await createPayment({ leaseId, date: '2029-06-15', amountUah: '100', method: 'CARD', note: 'x' })
    const upd = await updatePayment(created.id, { note: null })
    expect(upd.note).toBeNull()
  })

  it('некоректна сума → VALIDATION_FAILED (не 500)', async () => {
    const leaseId = await lease()
    await expect(createPayment({ leaseId, date: '2029-06-15', amountUah: 'abc', method: 'CASH' }))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('get/update/delete неіснуючого id → NOT_FOUND', async () => {
    await expect(getPayment('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(updatePayment('немає', { note: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(deletePayment('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('форма DTO і елемента списку — без полів БД (без createdAt)', async () => {
    const leaseId = await lease()
    const p = await createPayment({ leaseId, date: '2029-06-15', amountUah: '100', method: 'BANK', note: null })
    const keys = ['amountKop', 'date', 'id', 'leaseId', 'method', 'note']
    expect(Object.keys(p).sort()).toEqual(keys)
    const item = (await listPayments(leaseId)).find((x) => x.id === p.id)
    expect(Object.keys(item!).sort()).toEqual(keys)
  })

  it('listPayments(leaseId) повертає лише оплати цього договору, найновіші перші', async () => {
    const leaseId = await lease()
    await createPayment({ leaseId, date: '2029-05-01', amountUah: '100', method: 'CASH' })
    await createPayment({ leaseId, date: '2029-07-01', amountUah: '200', method: 'CASH' })
    const list = await listPayments(leaseId)
    expect(list).toHaveLength(2)
    expect(list[0]!.date).toContain('2029-07-01') // desc за датою
  })

  it('оновлення суми переписує копійки', async () => {
    const leaseId = await lease()
    const p = await createPayment({ leaseId, date: '2029-06-15', amountUah: '100', method: 'CASH' })
    const upd = await updatePayment(p.id, { amountUah: '250.25' })
    expect(upd.amountKop).toBe(25_025)
  })

  it('видаляє оплату', async () => {
    const leaseId = await lease()
    const p = await createPayment({ leaseId, date: '2029-06-15', amountUah: '100', method: 'CASH' })
    await deletePayment(p.id)
    await expect(getPayment(p.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npx vitest run tests/services/payments.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/payments'`

- [ ] **Step 3: Реалізувати**

`src/lib/validation/payment.ts`:
```ts
import { z } from 'zod'
import { optionalText, trimmed } from './common'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата у форматі YYYY-MM-DD')

export const paymentCreateSchema = z.object({
  leaseId: trimmed,
  date: isoDate,
  amountUah: z.string().trim().min(1),
  method: z.enum(['CASH', 'CARD', 'BANK']),
  note: optionalText,
})

export const paymentUpdateSchema = paymentCreateSchema.partial()

export type PaymentCreate = z.infer<typeof paymentCreateSchema>
export type PaymentUpdate = z.infer<typeof paymentUpdateSchema>
```

`src/server/services/payments.ts`:
```ts
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { InvalidAmountError } from '@/domain/errors'
import { toKop } from '@/domain/money'
import type { PaymentCreate, PaymentUpdate } from '@/lib/validation/payment'

export interface PaymentDTO {
  id: string
  leaseId: string
  date: string
  amountKop: number
  method: 'CASH' | 'CARD' | 'BANK'
  note: string | null
}

function toDTO(p: Prisma.PaymentModel): PaymentDTO {
  return { id: p.id, leaseId: p.leaseId, date: p.date.toISOString(), amountKop: p.amountKop, method: p.method, note: p.note }
}

const notFound = () => new ApiError('NOT_FOUND', 'Оплату не знайдено')
const day = (d: string) => new Date(`${d}T00:00:00.000Z`)

function amountKop(uah: string): number {
  try {
    return toKop(uah)
  } catch (e) {
    if (e instanceof InvalidAmountError) throw new ApiError('VALIDATION_FAILED', 'Некоректна сума', { amount: e.message })
    throw e
  }
}

export async function listPayments(leaseId?: string): Promise<PaymentDTO[]> {
  return (await prisma.payment.findMany({
    where: leaseId ? { leaseId } : undefined,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })).map(toDTO)
}

export async function getPayment(id: string): Promise<PaymentDTO> {
  const p = await prisma.payment.findUnique({ where: { id } })
  if (!p) throw notFound()
  return toDTO(p)
}

export async function createPayment(data: PaymentCreate): Promise<PaymentDTO> {
  return toDTO(await prisma.payment.create({
    data: { leaseId: data.leaseId, date: day(data.date), amountKop: amountKop(data.amountUah), method: data.method, note: data.note ?? null },
  }))
}

export async function updatePayment(id: string, data: PaymentUpdate): Promise<PaymentDTO> {
  await getPayment(id)
  const patch: Prisma.PaymentUpdateInput = {}
  if (data.leaseId !== undefined) patch.lease = { connect: { id: data.leaseId } }
  if (data.date !== undefined) patch.date = day(data.date)
  if (data.amountUah !== undefined) patch.amountKop = amountKop(data.amountUah)
  if (data.method !== undefined) patch.method = data.method
  if (data.note !== undefined) patch.note = data.note // optionalText: '' → null
  return toDTO(await prisma.payment.update({ where: { id }, data: patch }))
}

export async function deletePayment(id: string): Promise<void> {
  await getPayment(id)
  await prisma.payment.delete({ where: { id } })
}
```

> `note` типу `optionalText`: відсутнє поле → `undefined` (не в patch, значення без
> змін), порожній рядок → `null` (очищення). У `createPayment` `data.note ?? null`
> дає `null` і для undefined, і для '' — на створенні різниці немає.

`src/app/api/payments/route.ts`:
```ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createPayment, listPayments } from '@/server/services/payments'
import { paymentCreateSchema } from '@/lib/validation/payment'

export const GET = route(async (req) => {
  await requireUser()
  const leaseId = req.nextUrl.searchParams.get('leaseId') ?? undefined
  return json(await listPayments(leaseId))
})

export const POST = route(async (req) => {
  await requireUser()
  return json(await createPayment(await parseBody(req, paymentCreateSchema)), 201)
})
```

`src/app/api/payments/[id]/route.ts`:
```ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deletePayment, getPayment, updatePayment } from '@/server/services/payments'
import { paymentUpdateSchema } from '@/lib/validation/payment'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getPayment((await params).id))
})
export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updatePayment((await params).id, await parseBody(req, paymentUpdateSchema)))
})
export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deletePayment((await params).id)
  return json({ ok: true })
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npx vitest run tests/services/payments.test.ts`
Expected: PASS — 8 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/validation/payment.ts src/server/services/payments.ts \
  src/app/api/payments tests/services/payments.test.ts
git commit -m "feat(api): CRUD оплат

Оплата належить договору (date, amountKop, method CASH/CARD/BANK, note?).
Сума вводиться в грн, конвертується toKop на межі (помилка → VALIDATION_FAILED).
listPayments(leaseId?) фільтрує за договором, найновіші перші."
```

---

### Task 2: Звіт боргів

**Files:**
- Create: `src/server/services/reports.ts` (перша функція `reportDebts`)
- Create: `src/app/api/reports/debts/route.ts`
- Test: `tests/services/reports.test.ts` (перший describe)

**Interfaces:**
- Consumes: `prisma`, `debtKop`, `advanceKop` з `@/domain/debt`
- Produces:
  - `interface DebtRow { leaseId; tenantName; premisesLabel; invoicedKop: number; paidKop: number; debtKop: number; advanceKop: number }`
  - `reportDebts(): Promise<DebtRow[]>` — усі договори, що мають хоч рахунок або
    оплату; сортування за `debtKop` спаданням, потім `tenantName`.

- [ ] **Step 1: Написати падаючі тести**

`tests/services/reports.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { reportDebts } from '@/server/services/reports'
import { prisma } from '@/server/db'

let ids: Record<string, string> = {}
afterEach(async () => {
  if (ids.lease) {
    await prisma.payment.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.invoice.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.lease.deleteMany({ where: { id: ids.lease } })
    await prisma.premises.deleteMany({ where: { id: ids.prem } })
    await prisma.tenant.deleteMany({ where: { id: ids.ten } })
    await prisma.location.deleteMany({ where: { name: 'Звіт' } })
  }
  ids = {}
})

// Рахунок за місяць (year 2029 — ізоляція від seed) з довільним total.
async function leaseWith(totalKop: number) {
  const loc = await prisma.location.create({ data: { name: 'Звіт', address: 'вул. З, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'Z1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Боржник Б' } })
  const l = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: totalKop, garbageKop: 0 } })
  await prisma.invoice.create({ data: {
    leaseId: l.id, year: 2029, month: 6, electricityRateKop: 0, waterRateKop: 0,
    prevElectricity: '0', currElectricity: '0', electricityUsed: '0', prevWater: '0', currWater: '0', waterUsed: '0',
    rentKop: totalKop, electricityKop: 0, waterKop: 0, garbageKop: 0, totalKop,
  } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: l.id }
  return l.id
}

describe('reportDebts', () => {
  it('без оплат: борг = сума рахунків, аванс = 0', async () => {
    const leaseId = await leaseWith(100_000)
    const row = (await reportDebts()).find((r) => r.leaseId === leaseId)!
    expect(row.invoicedKop).toBe(100_000)
    expect(row.paidKop).toBe(0)
    expect(row.debtKop).toBe(100_000)
    expect(row.advanceKop).toBe(0)
    expect(row.tenantName).toBe('Боржник Б')
    expect(row.premisesLabel).toContain('Z1')
  })

  it('переплата: борг = 0, аванс = переплата', async () => {
    const leaseId = await leaseWith(100_000)
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 130_000, method: 'CASH' } })
    const row = (await reportDebts()).find((r) => r.leaseId === leaseId)!
    expect(row.debtKop).toBe(0)
    expect(row.advanceKop).toBe(30_000)
  })

  it('форма елемента звіту — фіксований набір ключів', async () => {
    const leaseId = await leaseWith(100_000)
    const row = (await reportDebts()).find((r) => r.leaseId === leaseId)!
    expect(Object.keys(row).sort()).toEqual(['advanceKop', 'debtKop', 'invoicedKop', 'leaseId', 'paidKop', 'premisesLabel', 'tenantName'])
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npx vitest run tests/services/reports.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/reports'`

- [ ] **Step 3: Реалізувати**

`src/server/services/reports.ts`:
```ts
import { prisma } from '@/server/db'
import { advanceKop, debtKop } from '@/domain/debt'

export interface DebtRow {
  leaseId: string
  tenantName: string
  premisesLabel: string
  invoicedKop: number
  paidKop: number
  debtKop: number
  advanceKop: number
}

/** Борг/аванс по кожному договору з активністю (є рахунок або оплата). */
export async function reportDebts(): Promise<DebtRow[]> {
  const leases = await prisma.lease.findMany({
    include: {
      tenant: { select: { name: true } },
      premises: { select: { unitNumber: true, location: { select: { name: true } } } },
      invoices: { select: { totalKop: true } },
      payments: { select: { amountKop: true } },
    },
  })

  const rows: DebtRow[] = []
  for (const l of leases) {
    if (l.invoices.length === 0 && l.payments.length === 0) continue
    const invoicedKop = l.invoices.reduce((s, i) => s + i.totalKop, 0)
    const paidKop = l.payments.reduce((s, p) => s + p.amountKop, 0)
    rows.push({
      leaseId: l.id,
      tenantName: l.tenant.name,
      premisesLabel: `${l.premises.location.name} · ${l.premises.unitNumber}`,
      invoicedKop,
      paidKop,
      debtKop: debtKop(invoicedKop, paidKop),
      advanceKop: advanceKop(invoicedKop, paidKop),
    })
  }
  rows.sort((a, b) => b.debtKop - a.debtKop || a.tenantName.localeCompare(b.tenantName, 'uk'))
  return rows
}
```

`src/app/api/reports/debts/route.ts`:
```ts
import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { reportDebts } from '@/server/services/reports'

export const GET = route(async () => {
  await requireUser()
  return json(await reportDebts())
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npx vitest run tests/services/reports.test.ts`
Expected: PASS — 3 passed

- [ ] **Step 5: Коміт**

```bash
git add src/server/services/reports.ts src/app/api/reports/debts \
  tests/services/reports.test.ts
git commit -m "feat(api): звіт боргів

Борг/аванс по кожному договору з активністю через доменні debtKop/advanceKop
(борг = Σ рахунків − Σ оплат; відʼємне — аванс). Сортування за боргом спаданням."
```

---

### Task 3: Місячний звіт

**Files:**
- Modify: `src/server/services/reports.ts` (додати `reportMonthly`)
- Create: `src/app/api/reports/monthly/route.ts`
- Test: `tests/services/reports.test.ts` (додати describe `reportMonthly`)

**Interfaces:**
- Consumes: `listInvoices` з `@/server/services/invoices` (Task 6 Плану 2b — уже
  дає статус FIFO), `prisma`
- Produces:
  - `interface MonthlyRow { leaseId; tenantName; premisesLabel; totalKop: number; status: 'UNPAID' | 'PARTIAL' | 'PAID' }`
  - `interface MonthlyReport { year: number; month: number; rows: MonthlyRow[]; totalInvoicedKop: number; count: number }`
  - `reportMonthly(year: number, month: number): Promise<MonthlyReport>`

- [ ] **Step 1: Написати падаючі тести** (додати в `tests/services/reports.test.ts`)

```ts
import { reportMonthly } from '@/server/services/reports'
// ...усередині файлу, поряд із reportDebts describe:

describe('reportMonthly', () => {
  it('рядки за місяць зі статусом і підсумком; повна оплата → PAID', async () => {
    const leaseId = await leaseWith(100_000) // рахунок 2029-06
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 100_000, method: 'CASH' } })
    const rep = await reportMonthly(2029, 6)
    const row = rep.rows.find((r) => r.leaseId === leaseId)!
    expect(row.totalKop).toBe(100_000)
    expect(row.status).toBe('PAID')
    expect(row.tenantName).toBe('Боржник Б')
    expect(row.premisesLabel).toContain('Z1')
    // підсумок включає цей рахунок
    expect(rep.totalInvoicedKop).toBeGreaterThanOrEqual(100_000)
    expect(rep.count).toBeGreaterThanOrEqual(1)
  })

  it('інший місяць не містить рахунку', async () => {
    const leaseId = await leaseWith(100_000) // рахунок лише 2029-06
    const rep = await reportMonthly(2029, 7)
    expect(rep.rows.find((r) => r.leaseId === leaseId)).toBeUndefined()
  })

  it('форма елемента — фіксований набір ключів', async () => {
    const leaseId = await leaseWith(100_000)
    const row = (await reportMonthly(2029, 6)).rows.find((r) => r.leaseId === leaseId)!
    expect(Object.keys(row).sort()).toEqual(['leaseId', 'premisesLabel', 'status', 'tenantName', 'totalKop'])
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npx vitest run tests/services/reports.test.ts`
Expected: FAIL — `reportMonthly is not a function`

- [ ] **Step 3: Реалізувати** (додати в `src/server/services/reports.ts`)

```ts
import { listInvoices } from '@/server/services/invoices'
// (prisma вже імпортовано)

export interface MonthlyRow {
  leaseId: string
  tenantName: string
  premisesLabel: string
  totalKop: number
  status: 'UNPAID' | 'PARTIAL' | 'PAID'
}

export interface MonthlyReport {
  year: number
  month: number
  rows: MonthlyRow[]
  totalInvoicedKop: number
  count: number
}

/** Місячний звіт: рахунки за (year, month) зі статусом FIFO + підсумок.
 *  Статус бере вже тестований listInvoices — DRY, без дублювання алокації. */
export async function reportMonthly(year: number, month: number): Promise<MonthlyReport> {
  const invoices = await listInvoices(year, month)
  const leaseIds = [...new Set(invoices.map((i) => i.leaseId))]
  const leases = await prisma.lease.findMany({
    where: { id: { in: leaseIds } },
    select: { id: true, tenant: { select: { name: true } }, premises: { select: { unitNumber: true, location: { select: { name: true } } } } },
  })
  const label = new Map(leases.map((l) => [l.id, { tenantName: l.tenant.name, premisesLabel: `${l.premises.location.name} · ${l.premises.unitNumber}` }]))

  const rows: MonthlyRow[] = invoices.map((i) => ({
    leaseId: i.leaseId,
    tenantName: label.get(i.leaseId)?.tenantName ?? '',
    premisesLabel: label.get(i.leaseId)?.premisesLabel ?? '',
    totalKop: i.totalKop,
    status: i.status,
  }))
  return { year, month, rows, totalInvoicedKop: rows.reduce((s, r) => s + r.totalKop, 0), count: rows.length }
}
```

`src/app/api/reports/monthly/route.ts`:
```ts
import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { parseYearMonth } from '@/server/query'
import { reportMonthly } from '@/server/services/reports'

export const GET = route(async (req) => {
  await requireUser()
  const { year, month } = parseYearMonth(req.nextUrl.searchParams)
  return json(await reportMonthly(year, month))
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npx vitest run tests/services/reports.test.ts`
Expected: PASS — 6 passed (3 debts + 3 monthly)

- [ ] **Step 5: Коміт**

```bash
git add src/server/services/reports.ts src/app/api/reports/monthly \
  tests/services/reports.test.ts
git commit -m "feat(api): місячний звіт

Рахунки за місяць зі статусом FIFO (через listInvoices — DRY) плюс підсумок
Σ нарахувань і кількість. Роут через parseYearMonth."
```

---

### Task 4: Історія приміщення

**Files:**
- Modify: `src/server/services/reports.ts` (додати `reportPremisesHistory`)
- Create: `src/app/api/reports/premises/[id]/route.ts`
- Test: `tests/services/reports.test.ts` (додати describe)

**Interfaces:**
- Consumes: `prisma`, `ApiError`, `allocatePayments` з `@/domain/allocation`,
  `leaseState` з `@/domain/status`, типи `InvoiceForAllocation`/`InvoiceStatus` з `@/domain/types`
- Produces:
  - `interface HistoryInvoice { id; year; month; totalKop: number; status: InvoiceStatus }`
  - `interface HistoryLease { leaseId; tenantName; startDate: string; endDate: string | null; status: 'ACTIVE' | 'ENDED'; invoices: HistoryInvoice[] }`
  - `interface PremisesHistory { premisesId; premisesLabel; leases: HistoryLease[] }`
  - `reportPremisesHistory(premisesId: string): Promise<PremisesHistory>` — `NOT_FOUND`, якщо приміщення немає

- [ ] **Step 1: Написати падаючі тести** (додати в `tests/services/reports.test.ts`)

```ts
import { reportPremisesHistory } from '@/server/services/reports'
// ...

describe('reportPremisesHistory', () => {
  it('групує рахунки за договорами приміщення зі статусами', async () => {
    const leaseId = await leaseWith(100_000) // рахунок 2029-06, prem = ids.prem
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 40_000, method: 'CASH' } })
    const h = await reportPremisesHistory(ids.prem!)
    expect(h.premisesLabel).toContain('Z1')
    const lease = h.leases.find((x) => x.leaseId === leaseId)!
    expect(lease.tenantName).toBe('Боржник Б')
    expect(lease.status).toBe('ACTIVE')
    const inv = lease.invoices.find((i) => i.year === 2029 && i.month === 6)!
    expect(inv.totalKop).toBe(100_000)
    expect(inv.status).toBe('PARTIAL') // 40k із 100k
  })

  it('приміщення без id → NOT_FOUND', async () => {
    await expect(reportPremisesHistory('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npx vitest run tests/services/reports.test.ts`
Expected: FAIL — `reportPremisesHistory is not a function`

- [ ] **Step 3: Реалізувати** (додати в `src/server/services/reports.ts`)

```ts
import { ApiError } from '@/server/http'
import { allocatePayments } from '@/domain/allocation'
import { leaseState } from '@/domain/status'
import type { InvoiceForAllocation, InvoiceStatus } from '@/domain/types'

export interface HistoryInvoice {
  id: string
  year: number
  month: number
  totalKop: number
  status: InvoiceStatus
}

export interface HistoryLease {
  leaseId: string
  tenantName: string
  startDate: string
  endDate: string | null
  status: 'ACTIVE' | 'ENDED'
  invoices: HistoryInvoice[]
}

export interface PremisesHistory {
  premisesId: string
  premisesLabel: string
  leases: HistoryLease[]
}

/** FIFO-статуси всіх рахунків одного договору (як у invoices-view, локально). */
function statusesForLease(invoices: { id: string; year: number; month: number; createdAt: Date; totalKop: number }[], totalPaidKop: number): Map<string, InvoiceStatus> {
  const forAlloc: InvoiceForAllocation[] = invoices.map((i) => ({ id: i.id, year: i.year, month: i.month, createdAt: i.createdAt, totalKop: i.totalKop }))
  const { byInvoiceId } = allocatePayments(forAlloc, totalPaidKop)
  const map = new Map<string, InvoiceStatus>()
  for (const [id, entry] of byInvoiceId) map.set(id, entry.status)
  return map
}

export async function reportPremisesHistory(premisesId: string): Promise<PremisesHistory> {
  const premises = await prisma.premises.findUnique({
    where: { id: premisesId },
    select: { id: true, unitNumber: true, location: { select: { name: true } } },
  })
  if (!premises) throw new ApiError('NOT_FOUND', 'Приміщення не знайдено')

  const leases = await prisma.lease.findMany({
    where: { premisesId },
    orderBy: { startDate: 'desc' },
    include: {
      tenant: { select: { name: true } },
      invoices: { select: { id: true, year: true, month: true, createdAt: true, totalKop: true }, orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      payments: { select: { amountKop: true } },
    },
  })

  const historyLeases: HistoryLease[] = leases.map((l) => {
    const totalPaid = l.payments.reduce((s, p) => s + p.amountKop, 0)
    const status = statusesForLease(l.invoices, totalPaid)
    return {
      leaseId: l.id,
      tenantName: l.tenant.name,
      startDate: l.startDate.toISOString(),
      endDate: l.endDate ? l.endDate.toISOString() : null,
      status: leaseState({ startDate: l.startDate, endDate: l.endDate }, new Date()),
      invoices: l.invoices.map((i) => ({ id: i.id, year: i.year, month: i.month, totalKop: i.totalKop, status: status.get(i.id) ?? 'UNPAID' })),
    }
  })

  return { premisesId: premises.id, premisesLabel: `${premises.location.name} · ${premises.unitNumber}`, leases: historyLeases }
}
```

`src/app/api/reports/premises/[id]/route.ts`:
```ts
import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { reportPremisesHistory } from '@/server/services/reports'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await reportPremisesHistory((await params).id))
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npx vitest run tests/services/reports.test.ts`
Expected: PASS — 8 passed

- [ ] **Step 5: Коміт**

```bash
git add src/server/services/reports.ts src/app/api/reports/premises \
  tests/services/reports.test.ts
git commit -m "feat(api): історія приміщення

Договори приміщення (найновіші перші) з рахунками й FIFO-статусами та похідним
статусом договору. NOT_FOUND, якщо приміщення немає."
```

---

### Task 5: Експорт CSV

**Files:**
- Create: `src/server/csv.ts`, `src/app/api/reports/export/route.ts`
- Test: `tests/server/csv.test.ts`

**Interfaces:**
- Consumes: `reportDebts`, `reportMonthly` з `@/server/services/reports`,
  `fromKop` з `@/domain/money`, `parseYearMonth` з `@/server/query`
- Produces: `toCsv(headers: string[], rows: (string | number)[][]): string`

- [ ] **Step 1: Написати падаючі тести**

`tests/server/csv.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { toCsv } from '@/server/csv'

describe('toCsv', () => {
  it('склеює заголовки й рядки через кому, рядки — CRLF', () => {
    const csv = toCsv(['a', 'b'], [[1, 'x'], [2, 'y']])
    expect(csv).toBe('﻿a,b\r\n1,x\r\n2,y')
  })

  it('BOM (U+FEFF) попереду — щоб Excel відкрив UTF-8 кирилицю коректно', () => {
    expect(toCsv(['Орендар'], [['Іван']]).startsWith('﻿')).toBe(true)
  })

  it('екранує значення з комою, лапками чи переносом (RFC 4180)', () => {
    const csv = toCsv(['c'], [['має, кому'], ['має "лапки"'], ['має\nперенос']])
    expect(csv).toContain('"має, кому"')
    expect(csv).toContain('"має ""лапки"""')
    expect(csv).toContain('"має\nперенос"')
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npx vitest run tests/server/csv.test.ts`
Expected: FAIL — `Cannot find module '@/server/csv'`

- [ ] **Step 3: Реалізувати**

`src/server/csv.ts`:
```ts
/** RFC 4180: поля з комою/лапками/переносом — у лапках, лапки подвоюються. */
function escapeField(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Серіалізує таблицю в CSV. Попереду — BOM (`﻿`), щоб Excel розпізнав
 * UTF-8 і не поламав кирилицю; рядки розділяє CRLF за RFC 4180.
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeField).join(','), ...rows.map((r) => r.map(escapeField).join(','))]
  return '﻿' + lines.join('\r\n') // U+FEFF BOM — пиши ЕСКЕЙПОМ, не невидимим літералом
}
```

> **BOM — обовʼязково escape `'﻿'`, не невидимий символ.** У коді вище (і в
> тесті `csv.test.ts`) BOM показано як символ `﻿` для читабельності, але в РЕАЛЬНОМУ
> коді пиши `'﻿'` — інакше невидимий літерал легко загубиться при копіюванні,
> і тест `expect(csv).toBe('﻿a,b\r\n1,x\r\n2,y')` порівнюй теж через escape.

`src/app/api/reports/export/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { requireUser } from '@/server/auth/guard'
import { ApiError, route } from '@/server/http'
import { parseYearMonth } from '@/server/query'
import { reportDebts, reportMonthly } from '@/server/services/reports'
import { fromKop } from '@/domain/money'

/** Суми у CSV — грн рядком (fromKop, крапка-роздільник) для парсингу таблицею. */
function csvResponse(csv: string, name: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
    },
  })
}

export const GET = route(async (req) => {
  await requireUser()
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'debts') {
    const rows = await reportDebts()
    const { toCsv } = await import('@/server/csv')
    const csv = toCsv(
      ['Орендар', 'Приміщення', 'Нараховано, грн', 'Оплачено, грн', 'Борг, грн', 'Аванс, грн'],
      rows.map((r) => [r.tenantName, r.premisesLabel, fromKop(r.invoicedKop), fromKop(r.paidKop), fromKop(r.debtKop), fromKop(r.advanceKop)]),
    )
    return csvResponse(csv, 'debts')
  }

  if (type === 'monthly') {
    const { year, month } = parseYearMonth(req.nextUrl.searchParams)
    const rep = await reportMonthly(year, month)
    const { toCsv } = await import('@/server/csv')
    const STATUS_UK: Record<string, string> = { UNPAID: 'Не оплачено', PARTIAL: 'Частково', PAID: 'Оплачено' }
    const csv = toCsv(
      ['Орендар', 'Приміщення', 'Сума, грн', 'Статус'],
      rep.rows.map((r) => [r.tenantName, r.premisesLabel, fromKop(r.totalKop), STATUS_UK[r.status] ?? r.status]),
    )
    return csvResponse(csv, `monthly-${year}-${String(month).padStart(2, '0')}`)
  }

  throw new ApiError('VALIDATION_FAILED', 'Потрібен type=debts або type=monthly')
})
```

> `import('@/server/csv')` — статичний імпорт теж годиться; динамічний тут лише
> щоб роут лишався тонким. Можна винести `import { toCsv }` нагору — на вибір
> імплементера, аби тест `csv.test.ts` лишався зеленим.

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npx vitest run tests/server/csv.test.ts`
Expected: PASS — 3 passed

- [ ] **Step 5: Коміт**

```bash
git add src/server/csv.ts src/app/api/reports/export tests/server/csv.test.ts
git commit -m "feat(api): експорт CSV (борги, місячний)

Чистий toCsv (RFC 4180 + BOM для Excel-кирилиці, CRLF). Роут /reports/export
?type=debts|monthly віддає text/csv attachment; суми — грн рядком (fromKop).
Невідомий type → VALIDATION_FAILED."
```

---

### Task 6: Наскрізна перевірка ланцюга (§9)

Замикання конвеєра з промту: seed → договір → показники → нарахування → оплата →
звіт → CSV. Один інтеграційний тест, що проганяє весь ланцюг на живій БД (рік 2029),
плюс повний прогін і збірка.

**Files:**
- Test: `tests/services/chain-e2e.test.ts`

**Interfaces:**
- Consumes: `generateInvoices` з `@/server/services/invoices`, `saveReadings` з
  `@/server/services/readings`, `createPayment` з `@/server/services/payments`,
  `reportDebts` з `@/server/services/reports`, `toCsv` з `@/server/csv`, `prisma`
  (сам рахунок читаємо прямим `prisma.invoice.findFirstOrThrow` — локальний хелпер)

- [ ] **Step 1: Написати падаючий тест**

`tests/services/chain-e2e.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/db'
import { saveReadings } from '@/server/services/readings'
import { generateInvoices } from '@/server/services/invoices'
import { createPayment } from '@/server/services/payments'
import { reportDebts } from '@/server/services/reports'
import { toCsv } from '@/server/csv'

let ids: Record<string, string> = {}
afterEach(async () => {
  if (ids.lease) {
    await prisma.payment.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.invoice.deleteMany({ where: { leaseId: ids.lease } })
    await prisma.meterReading.deleteMany({ where: { premisesId: ids.prem } })
    await prisma.lease.deleteMany({ where: { id: ids.lease } })
    await prisma.premises.deleteMany({ where: { id: ids.prem } })
    await prisma.tenant.deleteMany({ where: { id: ids.ten } })
    await prisma.tariff.deleteMany({ where: { id: ids.tariff } })
    await prisma.location.deleteMany({ where: { name: 'Ланцюг' } })
  }
  ids = {}
})

describe('наскрізний ланцюг: показники → нарахування → оплата → звіт → CSV', () => {
  it('проходить увесь конвеєр і дає узгоджений борг', async () => {
    const loc = await prisma.location.create({ data: { name: 'Ланцюг', address: 'вул. Л, 1' } })
    const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'C1', type: 'офіс', areaM2: '10' } })
    const ten = await prisma.tenant.create({ data: { name: 'Орендар Л' } })
    const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2029, 0, 1)), endDate: null, rentKop: 1_000_000, garbageKop: 30_000 } })
    const tariff = await prisma.tariff.create({ data: { effectiveFrom: new Date(Date.UTC(2029, 0, 1)), electricityRateKop: 432, waterRateKop: 1250 } })
    ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: lease.id, tariff: tariff.id }

    // показники двох місяців
    await saveReadings({ year: 2029, month: 5, entries: [{ premisesId: prem.id, electricity: '100', water: '9' }] })
    await saveReadings({ year: 2029, month: 6, entries: [{ premisesId: prem.id, electricity: '150', water: '12.5' }] })

    // нарахування
    const gen = await generateInvoices(2029, 6)
    expect(gen.created).toBe(1)
    const inv = (await listInvoicesSafe(lease.id))
    const totalKop = 1_000_000 + 50 * 432 + Math.round(3.5 * 1250) + 30_000
    expect(inv.totalKop).toBe(totalKop)

    // часткова оплата
    await createPayment({ leaseId: lease.id, date: '2029-06-20', amountUah: '5000', method: 'CASH' })

    // звіт боргів
    const row = (await reportDebts()).find((r) => r.leaseId === lease.id)!
    expect(row.invoicedKop).toBe(totalKop)
    expect(row.paidKop).toBe(500_000)
    expect(row.debtKop).toBe(totalKop - 500_000)

    // CSV не порожній і містить орендаря
    const csv = toCsv(['Орендар'], [[row.tenantName]])
    expect(csv).toContain('Орендар Л')
  })
})

async function listInvoicesSafe(leaseId: string) {
  const inv = await prisma.invoice.findFirstOrThrow({ where: { leaseId, year: 2029, month: 6 } })
  return inv
}
```

- [ ] **Step 2: Запустити — переконатися, що падає (спершу — червоний ланцюг)**

Run: `npx vitest run tests/services/chain-e2e.test.ts`
Expected: PASS одразу (усі ланки вже реалізовані Задачами 1–5 і Планами 1–2b).
Якщо падає — це справжня регресія інтеграції; діагностувати, не глушити.

> Це верифікаційна задача: код уже є, тест лише доводить, що ланки стикуються.
> RED тут не обовʼязковий — цінність у GREEN на живому ланцюгу.

- [ ] **Step 3: Прогнати весь набір і зібрати проєкт**

Run: `npx vitest run` → усі зелені. `npm run build` → успішно; нові роути
`/api/payments`, `/api/payments/[id]`, `/api/reports/debts`, `/api/reports/monthly`,
`/api/reports/premises/[id]`, `/api/reports/export` зареєстровані.

- [ ] **Step 4: Коміт**

```bash
git add tests/services/chain-e2e.test.ts
git commit -m "test(api): наскрізний ланцюг показники→нарахування→оплата→звіт→CSV

Крок 7 промту (§9): один інтеграційний тест проганяє весь грошовий конвеєр
на живій БД і звіряє борг = Σ нарахувань − Σ оплат."
```

---

## Підсумок плану

Після Task 6 грошовий конвеєр замкнено end-to-end:
- оплати (CRUD) на договір, грн→копійки на межі;
- звіт боргів (борг/аванс через доменні `debtKop`/`advanceKop`);
- місячний звіт зі статусом FIFO (переиспользує `listInvoices`);
- історія приміщення (договори + рахунки + статуси);
- експорт CSV (RFC 4180 + BOM для Excel-кирилиці);
- наскрізний тест усього ланцюга.

Наступний план — **План 3: UI** (порт дизайну Stitch на всі екрани, CSRF-токен,
версія для друку рахунку). Це завершить застосунок.

## Свідомі межі (для рев'ю)

- Route-handler'и не юніт-тестуються (async `cookies()` недоступний у Vitest) —
  логіка й тести в service-функціях; роути перевіряються `npm run build`.
- `reportDebts`/`reportMonthly`/історія глобальні (агрегують усю БД, як
  `generateInvoices`). Тести — рік 2029 для ізоляції від seed.
- CSV: суми — грн рядком через `fromKop` (крапка-роздільник) для парсингу; кома —
  роздільник полів (RFC 4180), BOM — для Excel. Якщо цільовий Excel-uk вимагає
  крапку з комою — тривіальна зміна роздільника, поза цим планом.
- CSRF-токен — у Плані 3 (клієнт має його відсилати).
- Відкладений Minor з фінального огляду 2b (concurrent `generateInvoices` → 500
  замість `INVOICE_EXISTS`) — поза 2c; рідка гонка, цілісність гарантує `@@unique`.
