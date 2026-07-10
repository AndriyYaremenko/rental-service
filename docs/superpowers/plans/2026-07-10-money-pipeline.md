# План 2b: Грошовий конвеєр (договори → показники → нарахування)

> **Для агентів:** ОБОВʼЯЗКОВИЙ СУБ-СКІЛ: `superpowers:subagent-driven-development`
> (рекомендовано) або `superpowers:executing-plans`. Кроки — чекбокси (`- [ ]`).

**Мета:** перетворити договори, показники лічильників і тарифи на рахунки —
серце обліку. Договори з перевіркою перетинів, масовий ввід показників,
формування нарахувань за місяць і обчислюваний статус рахунка.

**Архітектура:** тонкі route-handler'и над тестованими service-функціями (патерн
Плану 2a). **Оркестрація нарахувань — чиста доменна функція** `planMonthlyInvoices`
без БД: вона вирішує, який договір отримує рахунок, а який пропускається і чому.
Сервіс лише завантажує дані, кличе планувальник і персистить у транзакції. Гроші —
цілі копійки; `Decimal` — рядок; `Date` — ISO.

**Спека:** `docs/superpowers/specs/2026-07-10-rental-accounting-design.md` (§5.5, §6).
**Плани 1, 2a:** домен `src/domain/**` і auth/API-фундамент — готові, не змінюються
(крім додавання нового доменного модуля `generation.ts`).

Це третій із чотирьох планів. Наступний — **2c: оплати та звіти**.

## Global Constraints

Діють у **кожній** задачі.

- **Гроші — цілі копійки (`Int`).** У DTO API суми — `number` копійок; вхід у грн
  конвертується через `toKop` на межі сервісу (помилка → `VALIDATION_FAILED`).
  `Decimal` (показники) — рядок; `Date` — ISO-рядок.
- **Формат помилки за §6.1** (envelope із `@/server/http`). Коди 409:
  `LEASE_OVERLAP` (перетин договорів), `READING_DECREASED` (показник менший за
  попередній), `INVOICE_EXISTS` (нарахування вже є). `NOT_FOUND` 404, `VALIDATION_FAILED` 400.
- **Уся логіка — у service/domain; route-handler'и тонкі** (`await requireUser()` →
  parse → service → json), юніт-тестами не покриваються (перевіряються `npm run build`).
- **Оркестрація нарахувань — чиста функція `src/domain/generation.ts`**, тестована
  без БД, вичерпно (кожна причина пропуску + щасливий шлях).
- **Активність договору в місяці — тільки за датами** (`isLeaseActiveInMonth`),
  ніколи за збереженим статусом (його немає). Статус договору/рахунка — обчислюваний.
- **Мандаторні тести кожної CRUD-задачі:** update/delete неіснуючого id →
  `NOT_FOUND`; форма DTO (`Object.keys().sort()` — без витоку полів БД); форма
  елемента `listX()`; де є clearable-поле — персистенція явного `null`.
- Типи Prisma — з `@/generated/prisma/client`; `prisma` — з `@/server/db`.
- Ідентифікатори англійською; повідомлення й коміти українською.
- **TDD обовʼязковий** для service/domain. Не оновлювати TypeScript до 7, схему не чіпати.
- **CSRF відкладено до Плану 3** (токен має відсилати клієнт). `SameSite=lax` уже
  блокує міжсайтові POST/PATCH/DELETE — базовий захист грошових мутацій до UI.

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `src/lib/validation/lease.ts` | Zod: створення/оновлення договору |
| `src/server/services/leases.ts` | CRUD договорів, `LEASE_OVERLAP`, похідний статус |
| `src/lib/validation/reading.ts` | Zod: масовий ввід показників |
| `src/server/services/readings.ts` | огляд за місяць, масовий upsert, `READING_DECREASED` |
| `src/domain/generation.ts` | `planMonthlyInvoices` — чистий планувальник |
| `src/server/services/invoices.ts` | формування (персистенція плану), список, деталь, статуси |
| `src/app/api/leases/**`, `readings/**`, `invoices/**` | тонкі роути |
| `tests/domain/generation.test.ts`, `tests/services/*.test.ts` | тести |

---

### Task 1: Договори (CRUD) з перевіркою перетинів і похідним статусом

**Files:**
- Create: `src/lib/validation/lease.ts`, `src/server/services/leases.ts`
- Create: `src/app/api/leases/route.ts`, `src/app/api/leases/[id]/route.ts`
- Test: `tests/services/leases.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError`, `toKop` з `@/domain/money`, `hasOverlap` з
  `@/domain/overlap`, `leaseState` з `@/domain/status`, `Period` з `@/domain/types`
- Produces: `listLeases()`, `getLease(id)`, `createLease(data)`, `updateLease(id, data)`,
  `deleteLease(id)`;
  `interface LeaseDTO { id; premisesId; tenantId; startDate: string; endDate: string | null; rentKop: number; garbageKop: number; status: 'ACTIVE' | 'ENDED' }`

- [ ] **Step 1: Написати падаючі тести**

`tests/services/leases.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createLease, deleteLease, getLease, listLeases, updateLease } from '@/server/services/leases'
import { prisma } from '@/server/db'

const created: string[] = []
let premisesId = ''
let premisesId2 = ''
let tenantId = ''

afterEach(async () => {
  await prisma.lease.deleteMany({ where: { id: { in: created } } })
  created.length = 0
  await prisma.premises.deleteMany({ where: { id: { in: [premisesId, premisesId2].filter(Boolean) } } })
  await prisma.tenant.deleteMany({ where: { id: tenantId } })
  await prisma.location.deleteMany({ where: { name: 'Локація Д' } })
  premisesId = ''; premisesId2 = ''; tenantId = ''
})

async function fixtures() {
  const loc = await prisma.location.create({ data: { name: 'Локація Д', address: 'вул. Д, 1' } })
  premisesId = (await prisma.premises.create({ data: { locationId: loc.id, unitNumber: '1', type: 'офіс', areaM2: '20' } })).id
  premisesId2 = (await prisma.premises.create({ data: { locationId: loc.id, unitNumber: '2', type: 'офіс', areaM2: '30' } })).id
  tenantId = (await prisma.tenant.create({ data: { name: 'Орендар Д' } })).id
}
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('leases service', () => {
  it('створює договір; грн → копійки, дати ISO, статус похідний', async () => {
    await fixtures()
    const l = track(await createLease({
      premisesId, tenantId, startDate: '2026-01-01', endDate: null,
      rentUah: '18000.00', garbageUah: '300.00',
    }))
    expect(l.rentKop).toBe(1_800_000)
    expect(l.garbageKop).toBe(30_000)
    expect(l.startDate).toContain('2026-01-01')
    expect(l.endDate).toBeNull()
    expect(l.status).toBe('ACTIVE')
  })

  it('завершений договір (минула endDate) має статус ENDED', async () => {
    await fixtures()
    const l = track(await createLease({
      premisesId, tenantId, startDate: '2020-01-01', endDate: '2020-12-31',
      rentUah: '1000', garbageUah: '0',
    }))
    expect(l.status).toBe('ENDED')
  })

  it('перекриття періодів на тому самому приміщенні → LEASE_OVERLAP', async () => {
    await fixtures()
    track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: '2026-06-30', rentUah: '1', garbageUah: '0' }))
    await expect(createLease({ premisesId, tenantId, startDate: '2026-03-01', endDate: '2026-09-30', rentUah: '1', garbageUah: '0' }))
      .rejects.toMatchObject({ code: 'LEASE_OVERLAP' })
  })

  it('сусідній період на тому самому приміщенні дозволено', async () => {
    await fixtures()
    track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: '2026-03-31', rentUah: '1', garbageUah: '0' }))
    const ok = track(await createLease({ premisesId, tenantId, startDate: '2026-04-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    expect(ok.id).toBeDefined()
  })

  it('перекриття НЕ спрацьовує між різними приміщеннями', async () => {
    await fixtures()
    track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    const ok = track(await createLease({ premisesId: premisesId2, tenantId, startDate: '2026-01-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    expect(ok.id).toBeDefined()
  })

  it('оновлення договору не конфліктує сам із собою', async () => {
    await fixtures()
    const l = track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    const upd = await updateLease(l.id, { endDate: '2026-12-31' })
    expect(upd.endDate).toContain('2026-12-31')
  })

  it('update/delete неіснуючого id → NOT_FOUND', async () => {
    await expect(updateLease('немає', { endDate: null })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(deleteLease('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('форма DTO і елемента списку — без полів БД', async () => {
    await fixtures()
    const l = track(await createLease({ premisesId, tenantId, startDate: '2026-01-01', endDate: null, rentUah: '1', garbageUah: '0' }))
    const keys = ['endDate', 'garbageKop', 'id', 'premisesId', 'rentKop', 'startDate', 'status', 'tenantId']
    expect(Object.keys(l).sort()).toEqual(keys)
    const item = (await listLeases()).find((x) => x.id === l.id)
    expect(Object.keys(item!).sort()).toEqual(keys)
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/leases.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/leases'`

- [ ] **Step 3: Реалізувати**

`src/lib/validation/lease.ts`:
```ts
import { z } from 'zod'
import { trimmed } from './common'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата у форматі YYYY-MM-DD')

export const leaseCreateSchema = z.object({
  premisesId: trimmed,
  tenantId: trimmed,
  startDate: isoDate,
  endDate: isoDate.nullable(),
  rentUah: z.string().trim().min(1),
  garbageUah: z.string().trim().min(1),
})

export const leaseUpdateSchema = leaseCreateSchema.partial()

export type LeaseCreate = z.infer<typeof leaseCreateSchema>
export type LeaseUpdate = z.infer<typeof leaseUpdateSchema>
```

`src/server/services/leases.ts`:
```ts
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { InvalidAmountError } from '@/domain/errors'
import { toKop } from '@/domain/money'
import { hasOverlap } from '@/domain/overlap'
import { leaseState } from '@/domain/status'
import type { Period } from '@/domain/types'
import type { LeaseCreate, LeaseUpdate } from '@/lib/validation/lease'

export interface LeaseDTO {
  id: string
  premisesId: string
  tenantId: string
  startDate: string
  endDate: string | null
  rentKop: number
  garbageKop: number
  status: 'ACTIVE' | 'ENDED'
}

function toDTO(l: Prisma.LeaseModel): LeaseDTO {
  const period: Period = { startDate: l.startDate, endDate: l.endDate }
  return {
    id: l.id,
    premisesId: l.premisesId,
    tenantId: l.tenantId,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate ? l.endDate.toISOString() : null,
    rentKop: l.rentKop,
    garbageKop: l.garbageKop,
    status: leaseState(period, new Date()),
  }
}

const notFound = () => new ApiError('NOT_FOUND', 'Договір не знайдено')
const day = (d: string) => new Date(`${d}T00:00:00.000Z`)

function amounts(rentUah: string, garbageUah: string): { rentKop: number; garbageKop: number } {
  try {
    return { rentKop: toKop(rentUah), garbageKop: toKop(garbageUah) }
  } catch (e) {
    if (e instanceof InvalidAmountError) throw new ApiError('VALIDATION_FAILED', 'Некоректна сума', { rent: e.message })
    throw e
  }
}

/** Перетин серед УСІХ договорів приміщення (крім self при оновленні). */
async function ensureNoOverlap(premisesId: string, candidate: Period, exceptId?: string): Promise<void> {
  const others = await prisma.lease.findMany({
    where: { premisesId, id: exceptId ? { not: exceptId } : undefined },
    select: { startDate: true, endDate: true },
  })
  const existing: Period[] = others.map((o) => ({ startDate: o.startDate, endDate: o.endDate }))
  if (hasOverlap(existing, candidate)) {
    throw new ApiError('LEASE_OVERLAP', 'Періоди договорів на приміщенні перетинаються', { startDate: 'зайнято' })
  }
}

export async function listLeases(): Promise<LeaseDTO[]> {
  return (await prisma.lease.findMany({ orderBy: { startDate: 'desc' } })).map(toDTO)
}

export async function getLease(id: string): Promise<LeaseDTO> {
  const l = await prisma.lease.findUnique({ where: { id } })
  if (!l) throw notFound()
  return toDTO(l)
}

export async function createLease(data: LeaseCreate): Promise<LeaseDTO> {
  const candidate: Period = { startDate: day(data.startDate), endDate: data.endDate ? day(data.endDate) : null }
  await ensureNoOverlap(data.premisesId, candidate)
  const { rentKop, garbageKop } = amounts(data.rentUah, data.garbageUah)
  return toDTO(await prisma.lease.create({
    data: {
      premisesId: data.premisesId, tenantId: data.tenantId,
      startDate: candidate.startDate, endDate: candidate.endDate,
      rentKop, garbageKop,
    },
  }))
}

export async function updateLease(id: string, data: LeaseUpdate): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } })
  if (!existing) throw notFound()

  const startDate = data.startDate ? day(data.startDate) : existing.startDate
  const endDate = data.endDate !== undefined ? (data.endDate ? day(data.endDate) : null) : existing.endDate
  const premisesId = data.premisesId ?? existing.premisesId
  await ensureNoOverlap(premisesId, { startDate, endDate }, id)

  const patch: Prisma.LeaseUpdateInput = {}
  if (data.premisesId !== undefined) patch.premises = { connect: { id: data.premisesId } }
  if (data.tenantId !== undefined) patch.tenant = { connect: { id: data.tenantId } }
  if (data.startDate !== undefined) patch.startDate = startDate
  if (data.endDate !== undefined) patch.endDate = endDate
  if (data.rentUah !== undefined) patch.rentKop = amounts(data.rentUah, data.garbageUah ?? '0').rentKop
  if (data.garbageUah !== undefined) patch.garbageKop = amounts(data.rentUah ?? '0', data.garbageUah).garbageKop

  return toDTO(await prisma.lease.update({ where: { id }, data: patch }))
}

export async function deleteLease(id: string): Promise<void> {
  const l = await prisma.lease.findUnique({ where: { id } })
  if (!l) throw notFound()
  try {
    await prisma.lease.delete({ where: { id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiError('CONFLICT', 'Договір не можна видалити: є повʼязані рахунки або оплати')
    }
    throw e
  }
}
```

`src/app/api/leases/route.ts` і `[id]/route.ts` — за патерном Плану 2a
(`requireUser`, `parseBody`, service, `json`; POST 201; `[id]` — GET/PATCH/DELETE,
`await params`):
```ts
// src/app/api/leases/route.ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createLease, listLeases } from '@/server/services/leases'
import { leaseCreateSchema } from '@/lib/validation/lease'

export const GET = route(async () => {
  await requireUser()
  return json(await listLeases())
})
export const POST = route(async (req) => {
  await requireUser()
  return json(await createLease(await parseBody(req, leaseCreateSchema)), 201)
})
```
```ts
// src/app/api/leases/[id]/route.ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deleteLease, getLease, updateLease } from '@/server/services/leases'
import { leaseUpdateSchema } from '@/lib/validation/lease'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getLease((await params).id))
})
export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updateLease((await params).id, await parseBody(req, leaseUpdateSchema)))
})
export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deleteLease((await params).id)
  return json({ ok: true })
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/leases.test.ts`
Expected: PASS — 8 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/validation/lease.ts src/server/services/leases.ts \
  src/app/api/leases tests/services/leases.test.ts
git commit -m "feat(api): CRUD договорів із перевіркою перетинів

hasOverlap серед усіх договорів приміщення (крім self при оновленні) →
LEASE_OVERLAP. Статус ACTIVE/ENDED похідний (leaseState), не зберігається.
Оренда/сміття вводяться в грн, зберігаються в копійках."
```

---

### Task 2: Показники — огляд за місяць (GET)

**Files:**
- Create: `src/server/services/readings.ts`, `src/app/api/readings/route.ts` (лише GET поки)
- Test: `tests/services/readings-view.test.ts`

**Interfaces:**
- Consumes: `prisma`, `isLeaseActiveInMonth` з `@/domain/status`, `findPreviousReading` з `@/domain/readings`
- Produces:
  - `interface MeterPair { electricity: string; water: string }`
  - `interface ReadingRow { premisesId; unitNumber; locationName; current: MeterPair | null; previous: MeterPair | null }`
  - `getReadingsForMonth(year: number, month: number): Promise<ReadingRow[]>`

- [ ] **Step 1: Написати падаючі тести**

`tests/services/readings-view.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { getReadingsForMonth } from '@/server/services/readings'
import { prisma } from '@/server/db'

let ids: { loc?: string; prem?: string; ten?: string; lease?: string } = {}
afterEach(async () => {
  await prisma.meterReading.deleteMany({ where: { premisesId: ids.prem } })
  await prisma.lease.deleteMany({ where: { id: ids.lease } })
  await prisma.premises.deleteMany({ where: { id: ids.prem } })
  await prisma.tenant.deleteMany({ where: { id: ids.ten } })
  await prisma.location.deleteMany({ where: { id: ids.loc } })
  ids = {}
})

async function setup() {
  const loc = await prisma.location.create({ data: { name: 'Огляд', address: 'вул. О, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'R1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар О' } })
  const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: 1, garbageKop: 0 } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: lease.id }
  return ids
}

describe('getReadingsForMonth', () => {
  it('повертає приміщення з активним договором; previous — з попереднього місяця', async () => {
    const { prem } = await setup()
    await prisma.meterReading.create({ data: { premisesId: prem!, year: 2026, month: 5, electricity: '100', water: '10' } })
    await prisma.meterReading.create({ data: { premisesId: prem!, year: 2026, month: 6, electricity: '150', water: '13' } })

    const rows = await getReadingsForMonth(2026, 6)
    const row = rows.find((r) => r.premisesId === prem)
    expect(row).toBeDefined()
    expect(row!.current).toEqual({ electricity: '150', water: '13' })
    expect(row!.previous).toEqual({ electricity: '100', water: '10' })
  })

  it('current = null, якщо показника за місяць ще нема', async () => {
    const { prem } = await setup()
    await prisma.meterReading.create({ data: { premisesId: prem!, year: 2026, month: 5, electricity: '100', water: '10' } })
    const row = (await getReadingsForMonth(2026, 6)).find((r) => r.premisesId === prem)
    expect(row!.current).toBeNull()
    expect(row!.previous).toEqual({ electricity: '100', water: '10' })
  })

  it('приміщення без активного договору в місяці не потрапляє в огляд', async () => {
    const { prem, lease } = await setup()
    await prisma.lease.update({ where: { id: lease! }, data: { endDate: new Date(Date.UTC(2026, 2, 31)) } }) // до березня
    const row = (await getReadingsForMonth(2026, 6)).find((r) => r.premisesId === prem)
    expect(row).toBeUndefined()
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/readings-view.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/readings'`

- [ ] **Step 3: Реалізувати**

`src/server/services/readings.ts`:
```ts
import { prisma } from '@/server/db'
import { isLeaseActiveInMonth } from '@/domain/status'
import { findPreviousReading } from '@/domain/readings'

export interface MeterPair {
  electricity: string
  water: string
}

export interface ReadingRow {
  premisesId: string
  unitNumber: string
  locationName: string
  current: MeterPair | null
  previous: MeterPair | null
}

/** Приміщення з договором, активним у місяці, з поточним і попереднім показником. */
export async function getReadingsForMonth(year: number, month: number): Promise<ReadingRow[]> {
  const leases = await prisma.lease.findMany({
    select: { premisesId: true, startDate: true, endDate: true },
  })
  const activePremisesIds = new Set(
    leases.filter((l) => isLeaseActiveInMonth(l, year, month)).map((l) => l.premisesId),
  )
  if (activePremisesIds.size === 0) return []

  const premises = await prisma.premises.findMany({
    where: { id: { in: [...activePremisesIds] } },
    include: { location: { select: { name: true } }, readings: true },
    orderBy: [{ locationId: 'asc' }, { unitNumber: 'asc' }],
  })

  return premises.map((p) => {
    const current = p.readings.find((r) => r.year === year && r.month === month)
    const previous = findPreviousReading(p.readings, year, month)
    return {
      premisesId: p.id,
      unitNumber: p.unitNumber,
      locationName: p.location.name,
      current: current ? { electricity: current.electricity.toString(), water: current.water.toString() } : null,
      previous: previous ? { electricity: previous.electricity.toString(), water: previous.water.toString() } : null,
    }
  })
}
```

`src/app/api/readings/route.ts` (лише GET; POST додасть Task 3):
```ts
import { requireUser } from '@/server/auth/guard'
import { ApiError, json, route } from '@/server/http'
import { getReadingsForMonth } from '@/server/services/readings'

function period(req: import('next/server').NextRequest): { year: number; month: number } {
  const y = Number(req.nextUrl.searchParams.get('year'))
  const m = Number(req.nextUrl.searchParams.get('month'))
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new ApiError('VALIDATION_FAILED', 'Потрібні коректні year і month')
  }
  return { year: y, month: m }
}

export const GET = route(async (req) => {
  await requireUser()
  const { year, month } = period(req)
  return json(await getReadingsForMonth(year, month))
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/readings-view.test.ts`
Expected: PASS — 3 passed

- [ ] **Step 5: Коміт**

```bash
git add src/server/services/readings.ts src/app/api/readings/route.ts \
  tests/services/readings-view.test.ts
git commit -m "feat(api): огляд показників за місяць

Приміщення з договором, активним у місяці (за датами), з поточним і
попереднім показником. previous через доменний findPreviousReading —
перестрибує дірки в даних."
```

---

### Task 3: Показники — масовий upsert (POST) із READING_DECREASED

**Files:**
- Create: `src/lib/validation/reading.ts`
- Modify: `src/server/services/readings.ts` (додати `saveReadings`),
  `src/app/api/readings/route.ts` (додати POST)
- Test: `tests/services/readings-save.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError`, `findPreviousReading` з `@/domain/readings`
- Produces: `saveReadings(input: SaveReadingsInput): Promise<{ saved: number }>`;
  `interface ReadingEntry { premisesId; electricity: string; water: string; electricityReplaced?: boolean; electricityReplacedInitial?: string | null; waterReplaced?: boolean; waterReplacedInitial?: string | null }`;
  `interface SaveReadingsInput { year; month; entries: ReadingEntry[] }`

- [ ] **Step 1: Написати падаючі тести**

`tests/services/readings-save.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { saveReadings } from '@/server/services/readings'
import { prisma } from '@/server/db'

let premId = ''
afterEach(async () => {
  await prisma.meterReading.deleteMany({ where: { premisesId: premId } })
  await prisma.premises.deleteMany({ where: { id: premId } })
  await prisma.location.deleteMany({ where: { name: 'Збереж' } })
  premId = ''
})
async function prem() {
  const loc = await prisma.location.create({ data: { name: 'Збереж', address: 'вул. З, 1' } })
  premId = (await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'S1', type: 'офіс', areaM2: '10' } })).id
  return premId
}

describe('saveReadings', () => {
  it('зберігає показники за місяць', async () => {
    const id = await prem()
    const r = await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '150', water: '13' }] })
    expect(r.saved).toBe(1)
    const row = await prisma.meterReading.findFirstOrThrow({ where: { premisesId: id, year: 2026, month: 6 } })
    expect(row.electricity.toString()).toBe('150')
  })

  it('повторний upsert оновлює той самий місяць, не дублює', async () => {
    const id = await prem()
    await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '150', water: '13' }] })
    await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '160', water: '14' }] })
    const count = await prisma.meterReading.count({ where: { premisesId: id, year: 2026, month: 6 } })
    expect(count).toBe(1)
    const row = await prisma.meterReading.findFirstOrThrow({ where: { premisesId: id, year: 2026, month: 6 } })
    expect(row.electricity.toString()).toBe('160')
  })

  it('показник менший за попередній без заміни → READING_DECREASED', async () => {
    const id = await prem()
    await prisma.meterReading.create({ data: { premisesId: id, year: 2026, month: 5, electricity: '100', water: '10' } })
    await expect(saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '90', water: '11' }] }))
      .rejects.toMatchObject({ code: 'READING_DECREASED' })
  })

  it('менший показник ДОЗВОЛЕНО із прапорцем заміни лічильника', async () => {
    const id = await prem()
    await prisma.meterReading.create({ data: { premisesId: id, year: 2026, month: 5, electricity: '900', water: '10' } })
    const r = await saveReadings({ year: 2026, month: 6, entries: [
      { premisesId: id, electricity: '30', water: '11', electricityReplaced: true, electricityReplacedInitial: '0' },
    ] })
    expect(r.saved).toBe(1)
    const row = await prisma.meterReading.findFirstOrThrow({ where: { premisesId: id, year: 2026, month: 6 } })
    expect(row.electricityReplaced).toBe(true)
    expect(row.electricityReplacedInitial!.toString()).toBe('0')
  })

  it('перший показник (немає попереднього) зберігається без помилки', async () => {
    const id = await prem()
    const r = await saveReadings({ year: 2026, month: 6, entries: [{ premisesId: id, electricity: '150', water: '13' }] })
    expect(r.saved).toBe(1)
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/readings-save.test.ts`
Expected: FAIL — `saveReadings is not a function` / не експортовано

- [ ] **Step 3: Реалізувати**

`src/lib/validation/reading.ts`:
```ts
import { z } from 'zod'
import { trimmed } from './common'

const meter = z.string().trim().regex(/^\d+(\.\d{1,3})?$/, 'Показник — число до трьох знаків')

const entry = z.object({
  premisesId: trimmed,
  electricity: meter,
  water: meter,
  electricityReplaced: z.boolean().optional(),
  electricityReplacedInitial: meter.nullable().optional(),
  waterReplaced: z.boolean().optional(),
  waterReplacedInitial: meter.nullable().optional(),
})

export const saveReadingsSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  entries: z.array(entry).min(1),
})

export type SaveReadingsBody = z.infer<typeof saveReadingsSchema>
```

Додати в `src/server/services/readings.ts`:
```ts
import { ApiError } from '@/server/http'
import { Decimal } from 'decimal.js'
// (findPreviousReading, prisma вже імпортовані)

export interface ReadingEntry {
  premisesId: string
  electricity: string
  water: string
  electricityReplaced?: boolean
  electricityReplacedInitial?: string | null
  waterReplaced?: boolean
  waterReplacedInitial?: string | null
}

export interface SaveReadingsInput {
  year: number
  month: number
  entries: ReadingEntry[]
}

/** curr < prev без заміни лічильника — це помилка (лічильник не «відмотує»). */
function assertNotDecreased(
  premisesId: string, resource: 'електрики' | 'води',
  curr: string, prev: string | null, replaced: boolean | undefined,
): void {
  if (replaced || prev === null) return
  if (new Decimal(curr).lessThan(prev)) {
    throw new ApiError('READING_DECREASED', `Показник ${resource} менший за попередній`, { premisesId })
  }
}

export async function saveReadings(input: SaveReadingsInput): Promise<{ saved: number }> {
  const { year, month } = input
  for (const e of input.entries) {
    const readings = await prisma.meterReading.findMany({ where: { premisesId: e.premisesId } })
    const prev = findPreviousReading(readings, year, month)
    assertNotDecreased(e.premisesId, 'електрики', e.electricity, prev ? prev.electricity.toString() : null, e.electricityReplaced)
    assertNotDecreased(e.premisesId, 'води', e.water, prev ? prev.water.toString() : null, e.waterReplaced)

    await prisma.meterReading.upsert({
      where: { premisesId_year_month: { premisesId: e.premisesId, year, month } },
      update: {
        electricity: e.electricity, water: e.water,
        electricityReplaced: e.electricityReplaced ?? false,
        electricityReplacedInitial: e.electricityReplacedInitial ?? null,
        waterReplaced: e.waterReplaced ?? false,
        waterReplacedInitial: e.waterReplacedInitial ?? null,
      },
      create: {
        premisesId: e.premisesId, year, month,
        electricity: e.electricity, water: e.water,
        electricityReplaced: e.electricityReplaced ?? false,
        electricityReplacedInitial: e.electricityReplacedInitial ?? null,
        waterReplaced: e.waterReplaced ?? false,
        waterReplacedInitial: e.waterReplacedInitial ?? null,
      },
    })
  }
  return { saved: input.entries.length }
}
```

> Точну назву складеного unique-ключа (`premisesId_year_month`) підтвердь у
> згенерованому клієнті (`@@unique([premisesId, year, month])`); якщо Prisma
> назвала інакше — використай реальну назву (перевір у RED).

Додати POST у `src/app/api/readings/route.ts`:
```ts
import { parseBody } from '@/server/http'
import { saveReadings } from '@/server/services/readings'
import { saveReadingsSchema } from '@/lib/validation/reading'

export const POST = route(async (req) => {
  await requireUser()
  const body = await parseBody(req, saveReadingsSchema)
  return json(await saveReadings(body))
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/readings-save.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/validation/reading.ts src/server/services/readings.ts \
  src/app/api/readings/route.ts tests/services/readings-save.test.ts
git commit -m "feat(api): масовий upsert показників із READING_DECREASED

curr < prev без заміни лічильника → 409 READING_DECREASED (клієнт повторить
із прапорцем заміни). Upsert за (premises, year, month) — повтор не дублює."
```

---

### Task 4: Планувальник нарахувань — чиста доменна функція

Це коронна задача: вирішує, який договір отримує рахунок, а який пропускається
і чому. Без БД, вичерпно під тестами.

**Files:**
- Create: `src/domain/generation.ts`
- Test: `tests/domain/generation.test.ts`

**Interfaces:**
- Consumes: `isLeaseActiveInMonth` з `./status`, `findPreviousReading` з `./readings`,
  `pickTariffForMonth`, `TariffRecord` з `./tariff`, `buildInvoice` з `./invoice`,
  `Decimal` з `decimal.js`
- Produces:
  - `interface GenLease { leaseId; premisesId; startDate: Date; endDate: Date | null; rentKop: number; garbageKop: number }`
  - `interface GenReading { premisesId; year; month; electricity: Decimal; water: Decimal; electricityReplaced: boolean; electricityReplacedInitial: Decimal | null; waterReplaced: boolean; waterReplacedInitial: Decimal | null }`
  - `type SkipReason = 'NO_CURRENT_READING' | 'NO_PREVIOUS_READING' | 'NO_TARIFF' | 'ALREADY_EXISTS'`
  - `interface PlannedInvoice extends InvoiceLines { leaseId: string }`
  - `interface GenerationPlan { toCreate: PlannedInvoice[]; skipped: { leaseId: string; reason: SkipReason }[] }`
  - `interface PlanInput { year; month; leases: GenLease[]; readings: GenReading[]; tariffs: TariffRecord[]; existingLeaseIds: ReadonlySet<string> }`
  - `planMonthlyInvoices(input: PlanInput): GenerationPlan`

- [ ] **Step 1: Написати падаючі тести**

`tests/domain/generation.test.ts`:
```ts
import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { planMonthlyInvoices, type GenLease, type GenReading, type PlanInput } from '@/domain/generation'
import type { TariffRecord } from '@/domain/tariff'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

const lease = (o: Partial<GenLease> = {}): GenLease => ({
  leaseId: 'L1', premisesId: 'P1', startDate: utc(2026, 1, 1), endDate: null,
  rentKop: 1_000_000, garbageKop: 30_000, ...o,
})
const reading = (year: number, month: number, e: string, w: string, o: Partial<GenReading> = {}): GenReading => ({
  premisesId: 'P1', year, month, electricity: new Decimal(e), water: new Decimal(w),
  electricityReplaced: false, electricityReplacedInitial: null,
  waterReplaced: false, waterReplacedInitial: null, ...o,
})
const tariff: TariffRecord = { effectiveFrom: utc(2026, 1, 1), electricityRateKop: 432, waterRateKop: 1250 }

const base = (o: Partial<PlanInput> = {}): PlanInput => ({
  year: 2026, month: 6,
  leases: [lease()],
  readings: [reading(2026, 5, '100', '9'), reading(2026, 6, '150', '12.5')],
  tariffs: [tariff],
  existingLeaseIds: new Set<string>(),
  ...o,
})

describe('planMonthlyInvoices', () => {
  it('щасливий шлях: формує рахунок із правильними сумами', () => {
    const plan = planMonthlyInvoices(base())
    expect(plan.skipped).toEqual([])
    expect(plan.toCreate).toHaveLength(1)
    const inv = plan.toCreate[0]!
    expect(inv.leaseId).toBe('L1')
    expect(inv.electricityKop).toBe(50 * 432)
    expect(inv.waterKop).toBe(new Decimal('3.5').times(1250).toNumber())
    expect(inv.rentKop).toBe(1_000_000)
    expect(inv.totalKop).toBe(inv.rentKop + inv.electricityKop + inv.waterKop + inv.garbageKop)
  })

  it('пропускає договір, неактивний у місяці (за датами)', () => {
    const plan = planMonthlyInvoices(base({ leases: [lease({ endDate: utc(2026, 3, 31) })] }))
    // договір закінчився в березні — у червні його немає ні в toCreate, ні в skipped
    expect(plan.toCreate).toEqual([])
    expect(plan.skipped).toEqual([])
  })

  it('NO_CURRENT_READING, якщо немає показника за місяць', () => {
    const plan = planMonthlyInvoices(base({ readings: [reading(2026, 5, '100', '9')] }))
    expect(plan.toCreate).toEqual([])
    expect(plan.skipped).toEqual([{ leaseId: 'L1', reason: 'NO_CURRENT_READING' }])
  })

  it('NO_PREVIOUS_READING, якщо є лише поточний показник', () => {
    const plan = planMonthlyInvoices(base({ readings: [reading(2026, 6, '150', '12.5')] }))
    expect(plan.skipped).toEqual([{ leaseId: 'L1', reason: 'NO_PREVIOUS_READING' }])
  })

  it('NO_TARIFF, якщо жоден тариф не діє на кінець місяця', () => {
    const plan = planMonthlyInvoices(base({ tariffs: [{ effectiveFrom: utc(2027, 1, 1), electricityRateKop: 1, waterRateKop: 1 }] }))
    expect(plan.skipped).toEqual([{ leaseId: 'L1', reason: 'NO_TARIFF' }])
  })

  it('ALREADY_EXISTS, якщо для договору вже є рахунок за місяць', () => {
    const plan = planMonthlyInvoices(base({ existingLeaseIds: new Set(['L1']) }))
    expect(plan.toCreate).toEqual([])
    expect(plan.skipped).toEqual([{ leaseId: 'L1', reason: 'ALREADY_EXISTS' }])
  })

  it('ALREADY_EXISTS перевіряється ПЕРШИМ (навіть якби бракувало показника)', () => {
    const plan = planMonthlyInvoices(base({ existingLeaseIds: new Set(['L1']), readings: [] }))
    expect(plan.skipped).toEqual([{ leaseId: 'L1', reason: 'ALREADY_EXISTS' }])
  })

  it('замороженi ставки й база потрапляють у рахунок (для персистенції)', () => {
    const inv = planMonthlyInvoices(base()).toCreate[0]!
    expect(inv.electricityRateKop).toBe(432)
    expect(inv.prevElectricity.toString()).toBe('100')
    expect(inv.currElectricity.toString()).toBe('150')
  })

  it('кілька договорів обробляються незалежно', () => {
    const l2 = lease({ leaseId: 'L2', premisesId: 'P2' })
    const plan = planMonthlyInvoices(base({
      leases: [lease(), l2],
      readings: [reading(2026, 5, '100', '9'), reading(2026, 6, '150', '12.5')], // лише для P1
    }))
    expect(plan.toCreate.map((i) => i.leaseId)).toEqual(['L1'])
    expect(plan.skipped).toEqual([{ leaseId: 'L2', reason: 'NO_CURRENT_READING' }])
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/domain/generation.test.ts`
Expected: FAIL — `Cannot find module '@/domain/generation'`

- [ ] **Step 3: Реалізувати `src/domain/generation.ts`**

```ts
import type { Decimal } from 'decimal.js'
import { buildInvoice } from './invoice'
import { findPreviousReading } from './readings'
import { isLeaseActiveInMonth } from './status'
import { pickTariffForMonth, type TariffRecord } from './tariff'
import type { InvoiceLines, MeterSideInput } from './types'

export interface GenLease {
  leaseId: string
  premisesId: string
  startDate: Date
  endDate: Date | null
  rentKop: number
  garbageKop: number
}

export interface GenReading {
  premisesId: string
  year: number
  month: number
  electricity: Decimal
  water: Decimal
  electricityReplaced: boolean
  electricityReplacedInitial: Decimal | null
  waterReplaced: boolean
  waterReplacedInitial: Decimal | null
}

export type SkipReason = 'NO_CURRENT_READING' | 'NO_PREVIOUS_READING' | 'NO_TARIFF' | 'ALREADY_EXISTS'

export interface PlannedInvoice extends InvoiceLines {
  leaseId: string
}

export interface GenerationPlan {
  toCreate: PlannedInvoice[]
  skipped: { leaseId: string; reason: SkipReason }[]
}

export interface PlanInput {
  year: number
  month: number
  leases: GenLease[]
  readings: GenReading[]
  tariffs: TariffRecord[]
  existingLeaseIds: ReadonlySet<string>
}

function side(curr: Decimal, prev: Decimal | null, replaced: boolean, replacedInitial: Decimal | null): MeterSideInput {
  return { curr, prev, replaced, replacedInitial }
}

/**
 * Вирішує долю кожного договору за місяць. Чиста: жодних звернень до БД.
 *
 * - Неактивний у місяці договір (за датами) НЕ потрапляє нікуди.
 * - ALREADY_EXISTS перевіряється першим (рахунок уже сформовано).
 * - Далі: потрібні поточний показник, попередній показник і чинний тариф;
 *   якщо чогось бракує — договір пропускається з причиною, а не рахується від нуля.
 */
export function planMonthlyInvoices(input: PlanInput): GenerationPlan {
  const { year, month } = input
  const toCreate: PlannedInvoice[] = []
  const skipped: { leaseId: string; reason: SkipReason }[] = []

  for (const lease of input.leases) {
    if (!isLeaseActiveInMonth(lease, year, month)) continue

    if (input.existingLeaseIds.has(lease.leaseId)) {
      skipped.push({ leaseId: lease.leaseId, reason: 'ALREADY_EXISTS' })
      continue
    }

    const premisesReadings = input.readings.filter((r) => r.premisesId === lease.premisesId)
    const current = premisesReadings.find((r) => r.year === year && r.month === month)
    if (!current) {
      skipped.push({ leaseId: lease.leaseId, reason: 'NO_CURRENT_READING' })
      continue
    }
    const previous = findPreviousReading(premisesReadings, year, month)
    if (!previous) {
      skipped.push({ leaseId: lease.leaseId, reason: 'NO_PREVIOUS_READING' })
      continue
    }
    const tariff = pickTariffForMonth(input.tariffs, year, month)
    if (!tariff) {
      skipped.push({ leaseId: lease.leaseId, reason: 'NO_TARIFF' })
      continue
    }

    const lines = buildInvoice({
      electricity: side(current.electricity, previous.electricity, current.electricityReplaced, current.electricityReplacedInitial),
      water: side(current.water, previous.water, current.waterReplaced, current.waterReplacedInitial),
      terms: { rentKop: lease.rentKop, garbageKop: lease.garbageKop },
      rates: { electricityRateKop: tariff.electricityRateKop, waterRateKop: tariff.waterRateKop },
    })
    toCreate.push({ leaseId: lease.leaseId, ...lines })
  }

  return { toCreate, skipped }
}
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/domain/generation.test.ts`
Expected: PASS — 9 passed

- [ ] **Step 5: Коміт**

```bash
git add src/domain/generation.ts tests/domain/generation.test.ts
git commit -m "feat(domain): планувальник нарахувань — чиста функція

planMonthlyInvoices вирішує долю кожного договору: активний за датами,
ще не нарахований, має поточний+попередній показник і чинний тариф —
інакше пропуск із причиною. Без БД, вичерпно під тестами."
```

---

### Task 5: Формування нарахувань — сервіс і роут POST /generate

**Files:**
- Create: `src/server/services/invoices.ts`, `src/app/api/invoices/generate/route.ts`
- Test: `tests/services/invoices-generate.test.ts`

**Interfaces:**
- Consumes: `prisma`, `planMonthlyInvoices` та типи з `@/domain/generation`, `Decimal`
- Produces: `generateInvoices(year: number, month: number): Promise<{ created: number; skipped: { leaseId: string; reason: string }[] }>`

- [ ] **Step 1: Написати падаючий тест**

`tests/services/invoices-generate.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { generateInvoices } from '@/server/services/invoices'
import { prisma } from '@/server/db'

let ids: Record<string, string> = {}
afterEach(async () => {
  await prisma.invoice.deleteMany({ where: { leaseId: ids.lease } })
  await prisma.meterReading.deleteMany({ where: { premisesId: ids.prem } })
  await prisma.lease.deleteMany({ where: { id: ids.lease } })
  await prisma.premises.deleteMany({ where: { id: ids.prem } })
  await prisma.tenant.deleteMany({ where: { id: ids.ten } })
  await prisma.tariff.deleteMany({ where: { id: ids.tariff } })
  await prisma.location.deleteMany({ where: { name: 'Генер' } })
  ids = {}
})

async function setup() {
  const loc = await prisma.location.create({ data: { name: 'Генер', address: 'вул. Г, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'G1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар Г' } })
  const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: 1_000_000, garbageKop: 30_000 } })
  const tariff = await prisma.tariff.create({ data: { effectiveFrom: new Date(Date.UTC(2026, 0, 1)), electricityRateKop: 432, waterRateKop: 1250 } })
  await prisma.meterReading.create({ data: { premisesId: prem.id, year: 2026, month: 5, electricity: '100', water: '9' } })
  await prisma.meterReading.create({ data: { premisesId: prem.id, year: 2026, month: 6, electricity: '150', water: '12.5' } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: lease.id, tariff: tariff.id }
  return ids
}

describe('generateInvoices', () => {
  it('формує рахунок і зберігає заморожені суми', async () => {
    const { lease } = await setup()
    const r = await generateInvoices(2026, 6)
    expect(r.created).toBe(1)
    const inv = await prisma.invoice.findFirstOrThrow({ where: { leaseId: lease, year: 2026, month: 6 } })
    expect(inv.totalKop).toBe(1_000_000 + 50 * 432 + Math.round(3.5 * 1250) + 30_000)
    expect(inv.electricityRateKop).toBe(432)
    expect(inv.prevElectricity.toString()).toBe('100')
  })

  it('повторний виклик за той самий місяць нічого не створює (ALREADY_EXISTS)', async () => {
    const { lease } = await setup()
    await generateInvoices(2026, 6)
    const r = await generateInvoices(2026, 6)
    expect(r.created).toBe(0)
    expect(r.skipped).toContainEqual({ leaseId: lease, reason: 'ALREADY_EXISTS' })
    expect(await prisma.invoice.count({ where: { leaseId: lease, year: 2026, month: 6 } })).toBe(1)
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/invoices-generate.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/invoices'`

- [ ] **Step 3: Реалізувати**

`src/server/services/invoices.ts`:
```ts
import { Decimal } from 'decimal.js'
import { prisma } from '@/server/db'
import { planMonthlyInvoices, type GenLease, type GenReading } from '@/domain/generation'

export async function generateInvoices(
  year: number,
  month: number,
): Promise<{ created: number; skipped: { leaseId: string; reason: string }[] }> {
  const leaseRows = await prisma.lease.findMany()
  const leases: GenLease[] = leaseRows.map((l) => ({
    leaseId: l.id, premisesId: l.premisesId, startDate: l.startDate, endDate: l.endDate,
    rentKop: l.rentKop, garbageKop: l.garbageKop,
  }))

  const premisesIds = [...new Set(leases.map((l) => l.premisesId))]
  const readingRows = await prisma.meterReading.findMany({ where: { premisesId: { in: premisesIds } } })
  const readings: GenReading[] = readingRows.map((r) => ({
    premisesId: r.premisesId, year: r.year, month: r.month,
    electricity: new Decimal(r.electricity.toString()), water: new Decimal(r.water.toString()),
    electricityReplaced: r.electricityReplaced,
    electricityReplacedInitial: r.electricityReplacedInitial ? new Decimal(r.electricityReplacedInitial.toString()) : null,
    waterReplaced: r.waterReplaced,
    waterReplacedInitial: r.waterReplacedInitial ? new Decimal(r.waterReplacedInitial.toString()) : null,
  }))

  const tariffRows = await prisma.tariff.findMany()
  const tariffs = tariffRows.map((t) => ({ effectiveFrom: t.effectiveFrom, electricityRateKop: t.electricityRateKop, waterRateKop: t.waterRateKop }))

  const existing = await prisma.invoice.findMany({ where: { year, month }, select: { leaseId: true } })
  const existingLeaseIds = new Set(existing.map((e) => e.leaseId))

  const plan = planMonthlyInvoices({ year, month, leases, readings, tariffs, existingLeaseIds })

  // Персистимо у транзакції: суми й показники — рядки, які домен уже порахував.
  await prisma.$transaction(
    plan.toCreate.map((inv) =>
      prisma.invoice.create({
        data: {
          leaseId: inv.leaseId, year, month,
          electricityRateKop: inv.electricityRateKop, waterRateKop: inv.waterRateKop,
          prevElectricity: inv.prevElectricity.toString(), currElectricity: inv.currElectricity.toString(), electricityUsed: inv.electricityUsed.toString(),
          prevWater: inv.prevWater.toString(), currWater: inv.currWater.toString(), waterUsed: inv.waterUsed.toString(),
          rentKop: inv.rentKop, electricityKop: inv.electricityKop, waterKop: inv.waterKop, garbageKop: inv.garbageKop, totalKop: inv.totalKop,
        },
      }),
    ),
  )

  return { created: plan.toCreate.length, skipped: plan.skipped }
}
```

`src/app/api/invoices/generate/route.ts`:
```ts
import { requireUser } from '@/server/auth/guard'
import { ApiError, json, parseBody, route } from '@/server/http'
import { generateInvoices } from '@/server/services/invoices'
import { z } from 'zod'

const genSchema = z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) })

export const POST = route(async (req) => {
  await requireUser()
  const { year, month } = await parseBody(req, genSchema)
  return json(await generateInvoices(year, month))
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/invoices-generate.test.ts`
Expected: PASS — 2 passed

- [ ] **Step 5: Коміт**

```bash
git add src/server/services/invoices.ts src/app/api/invoices/generate \
  tests/services/invoices-generate.test.ts
git commit -m "feat(api): формування нарахувань за місяць

Сервіс завантажує договори/показники/тарифи/наявні рахунки, кличе чистий
planMonthlyInvoices і персистить план у транзакції. Заморожені суми й
показники — рядки, що порахував домен. Повтор за місяць нічого не дублює."
```

---

### Task 6: Рахунки — список і деталь з обчисленим статусом

**Files:**
- Modify: `src/server/services/invoices.ts` (додати `listInvoices`, `getInvoice`)
- Create: `src/app/api/invoices/route.ts`, `src/app/api/invoices/[id]/route.ts`
- Test: `tests/services/invoices-view.test.ts`

**Interfaces:**
- Consumes: `prisma`, `allocatePayments`, `InvoiceForAllocation`, `InvoiceStatus` з `@/domain/allocation`/`@/domain/types`, `ApiError`
- Produces:
  - `interface InvoiceDTO { id; leaseId; year; month; rentKop; electricityKop; waterKop; garbageKop; totalKop; status: InvoiceStatus }`
  - `interface InvoiceDetailDTO extends InvoiceDTO { electricityRateKop; waterRateKop; prevElectricity: string; currElectricity: string; electricityUsed: string; prevWater: string; currWater: string; waterUsed: string }`
  - `listInvoices(year: number, month: number): Promise<InvoiceDTO[]>`
  - `getInvoice(id: string): Promise<InvoiceDetailDTO>`

- [ ] **Step 1: Написати падаючі тести**

`tests/services/invoices-view.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { getInvoice, listInvoices } from '@/server/services/invoices'
import { prisma } from '@/server/db'

let ids: Record<string, string> = {}
afterEach(async () => {
  await prisma.payment.deleteMany({ where: { leaseId: ids.lease } })
  await prisma.invoice.deleteMany({ where: { leaseId: ids.lease } })
  await prisma.lease.deleteMany({ where: { id: ids.lease } })
  await prisma.premises.deleteMany({ where: { id: ids.prem } })
  await prisma.tenant.deleteMany({ where: { id: ids.ten } })
  await prisma.location.deleteMany({ where: { name: 'Статус' } })
  ids = {}
})

async function withInvoice(totalKop: number) {
  const loc = await prisma.location.create({ data: { name: 'Статус', address: 'вул. С, 1' } })
  const prem = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: 'I1', type: 'офіс', areaM2: '10' } })
  const ten = await prisma.tenant.create({ data: { name: 'Орендар І' } })
  const lease = await prisma.lease.create({ data: { premisesId: prem.id, tenantId: ten.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: totalKop, garbageKop: 0 } })
  const inv = await prisma.invoice.create({ data: {
    leaseId: lease.id, year: 2026, month: 6, electricityRateKop: 0, waterRateKop: 0,
    prevElectricity: '0', currElectricity: '0', electricityUsed: '0', prevWater: '0', currWater: '0', waterUsed: '0',
    rentKop: totalKop, electricityKop: 0, waterKop: 0, garbageKop: 0, totalKop,
  } })
  ids = { loc: loc.id, prem: prem.id, ten: ten.id, lease: lease.id, inv: inv.id }
  return { leaseId: lease.id, invId: inv.id }
}

describe('invoices view — обчислений статус', () => {
  it('без оплат → UNPAID', async () => {
    const { invId } = await withInvoice(100_000)
    const dto = (await listInvoices(2026, 6)).find((i) => i.id === invId)!
    expect(dto.status).toBe('UNPAID')
  })

  it('часткова оплата → PARTIAL; повна → PAID', async () => {
    const { leaseId, invId } = await withInvoice(100_000)
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 40_000, method: 'CASH' } })
    expect((await listInvoices(2026, 6)).find((i) => i.id === invId)!.status).toBe('PARTIAL')
    await prisma.payment.create({ data: { leaseId, date: new Date(), amountKop: 60_000, method: 'CASH' } })
    expect((await listInvoices(2026, 6)).find((i) => i.id === invId)!.status).toBe('PAID')
  })

  it('деталь містить розбивку показників як рядки', async () => {
    const { invId } = await withInvoice(100_000)
    const d = await getInvoice(invId)
    expect(typeof d.prevElectricity).toBe('string')
    expect(d.status).toBe('UNPAID')
  })

  it('getInvoice неіснуючого → NOT_FOUND', async () => {
    await expect(getInvoice('немає')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('форма елемента списку — без полів БД', async () => {
    const { invId } = await withInvoice(100_000)
    const dto = (await listInvoices(2026, 6)).find((i) => i.id === invId)!
    expect(Object.keys(dto).sort()).toEqual(['electricityKop', 'garbageKop', 'id', 'leaseId', 'month', 'rentKop', 'status', 'totalKop', 'waterKop', 'year'])
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/invoices-view.test.ts`
Expected: FAIL — `listInvoices is not a function`

- [ ] **Step 3: Реалізувати (додати в `src/server/services/invoices.ts`)**

```ts
import { ApiError } from '@/server/http'
import { allocatePayments } from '@/domain/allocation'
import type { InvoiceForAllocation, InvoiceStatus } from '@/domain/types'
import { Prisma } from '@/generated/prisma/client'

export interface InvoiceDTO {
  id: string
  leaseId: string
  year: number
  month: number
  rentKop: number
  electricityKop: number
  waterKop: number
  garbageKop: number
  totalKop: number
  status: InvoiceStatus
}

export interface InvoiceDetailDTO extends InvoiceDTO {
  electricityRateKop: number
  waterRateKop: number
  prevElectricity: string
  currElectricity: string
  electricityUsed: string
  prevWater: string
  currWater: string
  waterUsed: string
}

/** Статуси всіх рахунків договору через FIFO-рознесення його оплат. */
async function leaseStatuses(leaseId: string): Promise<Map<string, InvoiceStatus>> {
  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({ where: { leaseId }, select: { id: true, year: true, month: true, createdAt: true, totalKop: true } }),
    prisma.payment.findMany({ where: { leaseId }, select: { amountKop: true } }),
  ])
  const forAlloc: InvoiceForAllocation[] = invoices.map((i) => ({ id: i.id, year: i.year, month: i.month, createdAt: i.createdAt, totalKop: i.totalKop }))
  const totalPaid = payments.reduce((s, p) => s + p.amountKop, 0)
  const result = allocatePayments(forAlloc, totalPaid)
  const map = new Map<string, InvoiceStatus>()
  for (const [id, entry] of result.byInvoiceId) map.set(id, entry.status)
  return map
}

function toListDTO(i: Prisma.InvoiceModel, status: InvoiceStatus): InvoiceDTO {
  return {
    id: i.id, leaseId: i.leaseId, year: i.year, month: i.month,
    rentKop: i.rentKop, electricityKop: i.electricityKop, waterKop: i.waterKop, garbageKop: i.garbageKop, totalKop: i.totalKop,
    status,
  }
}

export async function listInvoices(year: number, month: number): Promise<InvoiceDTO[]> {
  const invoices = await prisma.invoice.findMany({ where: { year, month }, orderBy: { createdAt: 'asc' } })
  const byLease = new Map<string, Map<string, InvoiceStatus>>()
  const out: InvoiceDTO[] = []
  for (const i of invoices) {
    if (!byLease.has(i.leaseId)) byLease.set(i.leaseId, await leaseStatuses(i.leaseId))
    out.push(toListDTO(i, byLease.get(i.leaseId)!.get(i.id) ?? 'UNPAID'))
  }
  return out
}

export async function getInvoice(id: string): Promise<InvoiceDetailDTO> {
  const i = await prisma.invoice.findUnique({ where: { id } })
  if (!i) throw new ApiError('NOT_FOUND', 'Рахунок не знайдено')
  const status = (await leaseStatuses(i.leaseId)).get(i.id) ?? 'UNPAID'
  return {
    ...toListDTO(i, status),
    electricityRateKop: i.electricityRateKop, waterRateKop: i.waterRateKop,
    prevElectricity: i.prevElectricity.toString(), currElectricity: i.currElectricity.toString(), electricityUsed: i.electricityUsed.toString(),
    prevWater: i.prevWater.toString(), currWater: i.currWater.toString(), waterUsed: i.waterUsed.toString(),
  }
}
```

`src/app/api/invoices/route.ts` (GET list із year&month) і
`src/app/api/invoices/[id]/route.ts` (GET detail):
```ts
// src/app/api/invoices/route.ts
import { requireUser } from '@/server/auth/guard'
import { ApiError, json, route } from '@/server/http'
import { listInvoices } from '@/server/services/invoices'

export const GET = route(async (req) => {
  await requireUser()
  const y = Number(req.nextUrl.searchParams.get('year'))
  const m = Number(req.nextUrl.searchParams.get('month'))
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new ApiError('VALIDATION_FAILED', 'Потрібні коректні year і month')
  }
  return json(await listInvoices(y, m))
})
```
```ts
// src/app/api/invoices/[id]/route.ts
import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { getInvoice } from '@/server/services/invoices'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getInvoice((await params).id))
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/invoices-view.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Прогнати весь набір і зібрати проєкт**

Run: `npm test` → усі зелені; `npm run build` → успішно, нові `/api/leases`,
`/api/readings`, `/api/invoices`, `/api/invoices/generate`, `/api/invoices/[id]`.

- [ ] **Step 6: Коміт**

```bash
git add src/server/services/invoices.ts src/app/api/invoices \
  tests/services/invoices-view.test.ts
git commit -m "feat(api): список і деталь рахунків з обчисленим статусом

Статус (UNPAID/PARTIAL/PAID) — через доменний allocatePayments над усіма
рахунками й оплатами договору (FIFO). Ніде не зберігається. Деталь —
розбивка показників рядками."
```

---

## Підсумок плану

Після Task 6 маємо працюючий грошовий конвеєр:
- договори з перевіркою перетинів і похідним статусом;
- масовий ввід показників із захистом від зменшення та заміною лічильника;
- формування нарахувань через чистий планувальник (кожна причина пропуску —
  під тестом) і персистенцію заморожених сум;
- рахунки з обчислюваним статусом (FIFO), ніде не збереженим.

Наступний план (**2c: оплати та звіти**) додає запис оплат (CRUD) і звіти
(борги, місячний, історія приміщення, CSV) — поверх `allocatePayments`, `debtKop`
і `formatUah`, споживаючи рахунки, зроблені тут.
