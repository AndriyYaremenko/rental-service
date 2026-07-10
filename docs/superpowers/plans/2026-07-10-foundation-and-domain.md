# План 1: Фундамент і доменний шар

> **Для агентів:** ОБОВʼЯЗКОВИЙ СУБ-СКІЛ: використай `superpowers:subagent-driven-development`
> (рекомендовано) або `superpowers:executing-plans` для потаскового виконання.
> Кроки позначені чекбоксами (`- [ ]`).

**Мета:** отримати міграцію БД, seed із тестовими даними та повністю
покритий тестами доменний шар — усю грошову математику застосунку.

**Архітектура:** доменні модулі в `src/domain/` — чисті функції без імпортів
Prisma й React. Вони не знають про базу і про HTTP. Prisma-схема і seed живуть
окремо. Такий поділ дозволяє тестувати гроші без бази, браузера і моків.

**Стек:** TypeScript, Prisma 7.8 + SQLite, decimal.js, Vitest 4, Next.js 16 (каркас).

**Спека:** `docs/superpowers/specs/2026-07-10-rental-accounting-design.md`

## Global Constraints

Ці правила діють у **кожній** задачі плану.

- **Prisma 7:** генератор `provider = "prisma-client"` з обовʼязковим `output`.
  `prisma-client-js` — legacy, не використовувати.
- **Гроші — тільки цілі копійки (`Int`).** `Decimal` дозволений виключно для
  фізичних величин: показники лічильників, площа. Жодних `float` для сум.
- **Округлення — рівно один раз**, при формуванні рядка рахунку, режим
  `ROUND_HALF_UP`. Підсумок — сума вже округлених цілих.
- **`src/domain/**` не імпортує Prisma, React, Next чи будь-що з мережі.**
  Тільки `decimal.js` і власні модулі. Це перевіряється очима на код-рев'ю.
- **Жодного збереженого похідного стану** (§3.8 спеки): у схемі немає
  `Invoice.status`, `Premises.status`, `Lease.status`.
- **Активність договору в місяці визначається тільки датами**, ніколи статусом.
- **Мова:** ідентифікатори англійською, повідомлення помилок і коміти українською.
- **TDD-цикл обовʼязковий:** написати падаючий тест → переконатися, що падає →
  мінімальна реалізація → переконатися, що проходить → коміт.
- **`bcryptjs`**, а не `bcrypt`: чистий JS, не потребує нативної збірки на Windows.
- Enum на SQLite валідується лише на рівні ORM — база не захистить.

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `prisma/schema.prisma` | схема БД |
| `prisma/seed-data.ts` | функція `seed()` — тестові дані |
| `prisma/seed.ts` | тонкий CLI-обгортник над `seed()` |
| `src/server/db.ts` | singleton PrismaClient |
| `src/domain/types.ts` | спільні доменні типи |
| `src/domain/errors.ts` | доменні помилки |
| `src/domain/money.ts` | грн ↔ копійки, округлення, формат |
| `src/domain/consumption.ts` | споживання, заміна лічильника |
| `src/domain/readings.ts` | вибір попереднього показника (§5.1) |
| `src/domain/tariff.ts` | вибір чинного тарифу на місяць (§3.4) |
| `src/domain/invoice.ts` | побудова рядків рахунку |
| `src/domain/allocation.ts` | FIFO-рознесення оплат |
| `src/domain/debt.ts` | борг і аванс |
| `src/domain/status.ts` | похідні статуси, межі місяця |
| `src/domain/overlap.ts` | перетин періодів договорів |
| `tests/setup.ts` | завантаження `.env` для Vitest |
| `tests/domain/*.test.ts` | тести доменного шару |

---

### Task 1: Каркас проєкту і тестове оточення

`create-next-app` відмовляється працювати в непорожній директорії (у нас є
`docs/`), тому скафолд робимо вручну — це ще й детерміновано.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`
- Create: `.gitignore`, `.gitattributes`, `.env`, `.env.example`
- Create: `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: нічого (перша задача)
- Produces: npm-скрипти `test`, `dev`, `db:migrate`, `db:generate`, `db:seed`;
  alias `@/*` → `src/*` і в TS, і у Vitest

- [ ] **Step 1: Ініціалізувати package.json і встановити залежності**

```bash
npm init -y
npm pkg set name="rental-service" private=true
npm install next@16 react@19 react-dom@19 @prisma/client@7 decimal.js zod@4 bcryptjs
npm install -D typescript @types/node @types/react @types/react-dom \
  prisma@7 tsx vitest@4 tailwindcss@4 @tailwindcss/postcss@4 dotenv
```

`dotenv` потрібен саме для тестів: `.env` читають Prisma CLI і Next.js, але
**не Vitest**. Без нього Prisma Client не побачить `DATABASE_URL`.

- [ ] **Step 2: Прописати npm-скрипти**

```bash
npm pkg set scripts.dev="next dev"
npm pkg set scripts.build="next build"
npm pkg set scripts.start="next start"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.db:migrate="prisma migrate dev"
npm pkg set scripts.db:generate="prisma generate"
npm pkg set scripts.db:seed="tsx prisma/seed.ts"
npm pkg set scripts.db:studio="prisma studio"
```

Seed запускається через `tsx`, а не `prisma db seed` — щоб не залежати від
формату конфігурації Prisma, який змінювався між мажорами.

- [ ] **Step 3: Створити конфігураційні файли**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Тести БД пишуть в один файл SQLite — паралельні файли дали б флак
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

`tests/setup.ts`:
```ts
import 'dotenv/config'
```

`postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

`.gitattributes` — Git уже попереджав про заміну LF на CRLF:
```
* text=auto eol=lf
```

`.gitignore`:
```
node_modules/
.next/
out/
build/
*.tsbuildinfo
next-env.d.ts

# Prisma
src/generated/
prisma/*.db
prisma/*.db-journal

# Секрети
.env
.env.local
```

`.env`:
```
DATABASE_URL="file:./dev.db"
SESSION_SECRET="dev-only-change-me"
```

`.env.example` — той самий вміст із порожніми значеннями (комітиться).

- [ ] **Step 4: Мінімальний каркас Next.js**

`src/app/globals.css`:
```css
@import "tailwindcss";
```

Токени макета (`@theme`) додаються в Плані 3 — тут потрібен лише робочий каркас.

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Облік комерційної оренди',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  )
}
```

`src/app/page.tsx`:
```tsx
export default function Home() {
  return <main>Облік комерційної оренди</main>
}
```

- [ ] **Step 5: Написати падаючий smoke-тест**

`tests/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest'

describe('тестове оточення', () => {
  it('вміє резолвити alias @/', async () => {
    const { APP_NAME } = await import('@/domain/constants')
    expect(APP_NAME).toBe('rental-service')
  })
})
```

- [ ] **Step 6: Запустити тест і переконатися, що падає**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/domain/constants'`

- [ ] **Step 7: Мінімальна реалізація**

`src/domain/constants.ts`:
```ts
export const APP_NAME = 'rental-service'
```

- [ ] **Step 8: Запустити тест і переконатися, що проходить**

Run: `npm test`
Expected: PASS — 1 passed

- [ ] **Step 9: Коміт**

```bash
git add -A
git commit -m "chore: каркас Next.js, TypeScript і Vitest

Скафолд зроблено вручну: create-next-app відмовляється працювати
в непорожній директорії. .gitattributes фіксує LF."
```

---

### Task 2: Prisma-схема, міграція і клієнт

**Files:**
- Create: `prisma/schema.prisma`, `src/server/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` з `.env` (Task 1)
- Produces: `prisma` — екземпляр `PrismaClient` з `@/server/db`;
  моделі `User`, `Location`, `Premises`, `Tenant`, `Lease`, `Tariff`,
  `MeterReading`, `Invoice`, `Payment`; enum `Role`, `PaymentMethod`

- [ ] **Step 1: Написати схему**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Role          { ADMIN USER }
enum PaymentMethod { CASH CARD BANK }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(USER)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Location {
  id        String     @id @default(cuid())
  name      String
  address   String
  notes     String?
  premises  Premises[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model Premises {
  id         String         @id @default(cuid())
  locationId String
  location   Location       @relation(fields: [locationId], references: [id], onDelete: Restrict)
  unitNumber String
  type       String
  floor      Int?
  areaM2     Decimal
  notes      String?
  leases     Lease[]
  readings   MeterReading[]
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  @@unique([locationId, unitNumber])
}

model Tenant {
  id        String   @id @default(cuid())
  name      String
  phone     String?
  email     String?
  taxCode   String?
  notes     String?
  leases    Lease[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Lease {
  id         String    @id @default(cuid())
  premisesId String
  premises   Premises  @relation(fields: [premisesId], references: [id], onDelete: Restrict)
  tenantId   String
  tenant     Tenant    @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  startDate  DateTime
  endDate    DateTime?
  rentKop    Int
  garbageKop Int
  invoices   Invoice[]
  payments   Payment[]
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([premisesId, startDate])
  @@index([tenantId])
}

model Tariff {
  id                 String   @id @default(cuid())
  effectiveFrom      DateTime @unique
  electricityRateKop Int
  waterRateKop       Int
  createdAt          DateTime @default(now())
}

model MeterReading {
  id          String   @id @default(cuid())
  premisesId  String
  premises    Premises @relation(fields: [premisesId], references: [id], onDelete: Cascade)
  year        Int
  month       Int
  electricity Decimal
  water       Decimal

  electricityReplaced        Boolean  @default(false)
  electricityReplacedInitial Decimal?
  waterReplaced              Boolean  @default(false)
  waterReplacedInitial       Decimal?

  readAt    DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([premisesId, year, month])
}

model Invoice {
  id      String @id @default(cuid())
  leaseId String
  lease   Lease  @relation(fields: [leaseId], references: [id], onDelete: Restrict)
  year    Int
  month   Int

  electricityRateKop Int
  waterRateKop       Int

  prevElectricity Decimal
  currElectricity Decimal
  electricityUsed Decimal
  prevWater       Decimal
  currWater       Decimal
  waterUsed       Decimal

  rentKop        Int
  electricityKop Int
  waterKop       Int
  garbageKop     Int
  totalKop       Int

  createdAt DateTime @default(now())

  @@unique([leaseId, year, month])
  @@index([year, month])
}

model Payment {
  id        String        @id @default(cuid())
  leaseId   String
  lease     Lease         @relation(fields: [leaseId], references: [id], onDelete: Restrict)
  date      DateTime
  amountKop Int
  method    PaymentMethod
  note      String?
  createdAt DateTime      @default(now())

  @@index([leaseId, date])
}
```

Полів `status` немає ніде — це навмисно (§3.8 спеки).
`prevElectricity` зберігає **базу розрахунку**: звичайний попередній показник
або початковий показник нового лічильника, якщо його міняли.

- [ ] **Step 2: Створити міграцію**

Run: `npm run db:migrate -- --name init`
Expected: створено `prisma/migrations/<timestamp>_init/migration.sql`,
у консолі — `Your database is now in sync with your schema.`

Перевір, що файл бази справді зʼявився поруч зі схемою:

Run: `ls prisma/dev.db`
Expected: файл існує. SQLite-шлях `file:./dev.db` резолвиться відносно
каталогу `prisma/`, а не кореня проєкту.

- [ ] **Step 3: Згенерувати клієнт і підтвердити шлях імпорту**

Run: `npm run db:generate && ls src/generated/prisma`
Expected: у каталозі є `client.ts` (або `index.ts`) та `.d.ts`-файли.
Запамʼятай точну назву — вона потрібна в наступному кроці. Не вгадуй її.

- [ ] **Step 4: Написати падаючий тест на підключення**

`tests/db.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/server/db'

describe('підключення до БД', () => {
  it('виконує запит до таблиці користувачів', async () => {
    // Навмисно не перевіряємо конкретну кількість: seed з Task 11
    // наповнює ту саму базу, і жорстка нуль-перевірка зробила б
    // цей тест залежним від порядку запуску.
    const count = await prisma.user.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('бачить усі очікувані моделі', () => {
    for (const model of ['user', 'location', 'premises', 'tenant', 'lease',
                         'tariff', 'meterReading', 'invoice', 'payment'] as const) {
      expect(prisma[model]).toBeDefined()
    }
  })
})
```

- [ ] **Step 5: Запустити тест і переконатися, що падає**

Run: `npm test -- tests/db.test.ts`
Expected: FAIL — `Cannot find module '@/server/db'`

- [ ] **Step 6: Реалізувати singleton клієнта**

`src/server/db.ts` (шлях імпорту — той, що підтверджено в Step 3):
```ts
// Відносний шлях, НЕ alias '@/': seed запускається через tsx,
// який не резолвить paths із tsconfig.
import { PrismaClient } from '../generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Singleton потрібен, бо hot-reload у dev інакше плодить підключення.
Тести імпортують цей модуль як `@/server/db` — alias резолвить Vitest.

- [ ] **Step 7: Запустити тест і переконатися, що проходить**

Run: `npm test -- tests/db.test.ts`
Expected: PASS

- [ ] **Step 8: Коміт**

```bash
git add -A
git commit -m "feat: Prisma-схема, початкова міграція, singleton клієнта

Генератор prisma-client (Prisma 7), не legacy prisma-client-js.
Похідні статуси в схемі відсутні навмисно."
```

---

### Task 3: Доменні типи, помилки і модуль грошей

**Files:**
- Create: `src/domain/types.ts`, `src/domain/errors.ts`, `src/domain/money.ts`
- Test: `tests/domain/money.test.ts`

**Interfaces:**
- Consumes: `decimal.js`
- Produces:
  - `type Kop = number`
  - `toKop(uah: string | number): Kop`
  - `fromKop(kop: Kop): string` — `'1234.56'`
  - `formatUah(kop: Kop): string` — `'1 234,56 грн'`
  - `roundHalfUp(value: Decimal): Kop`
  - `InvalidAmountError`, `NoPreviousReadingError`, `NegativeConsumptionError`
  - типи `MeterSideInput`, `LeaseTerms`, `TariffRates`, `InvoiceLines`,
    `InvoiceStatus`, `InvoiceForAllocation`, `AllocationResult`, `Period`

- [ ] **Step 1: Оголосити типи і помилки**

`src/domain/types.ts`:
```ts
import type { Decimal } from 'decimal.js'

/** Цілі копійки. Гроші в системі не бувають дробовими. */
export type Kop = number

export interface MeterSideInput {
  curr: Decimal
  prev: Decimal | null
  replaced: boolean
  replacedInitial: Decimal | null
}

export interface LeaseTerms {
  rentKop: Kop
  garbageKop: Kop
}

export interface TariffRates {
  electricityRateKop: Kop
  waterRateKop: Kop
}

export interface InvoiceLines {
  electricityUsed: Decimal
  waterUsed: Decimal
  rentKop: Kop
  electricityKop: Kop
  waterKop: Kop
  garbageKop: Kop
  totalKop: Kop
}

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

export interface InvoiceForAllocation {
  id: string
  year: number
  month: number
  createdAt: Date
  totalKop: Kop
}

export interface AllocationEntry {
  coveredKop: Kop
  status: InvoiceStatus
}

export interface AllocationResult {
  byInvoiceId: Map<string, AllocationEntry>
  advanceKop: Kop
}

/** endDate === null означає безстроковий період. */
export interface Period {
  startDate: Date
  endDate: Date | null
}
```

`src/domain/errors.ts`:
```ts
export class DomainError extends Error {}

export class InvalidAmountError extends DomainError {}

export class NoPreviousReadingError extends DomainError {
  constructor() {
    super('Немає попереднього показника лічильника')
  }
}

export class NegativeConsumptionError extends DomainError {
  constructor(used: string) {
    super(`Споживання не може бути відʼємним: ${used}`)
  }
}
```

- [ ] **Step 2: Написати падаючі тести на гроші**

`tests/domain/money.test.ts`:
```ts
import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { InvalidAmountError } from '@/domain/errors'
import { formatUah, fromKop, roundHalfUp, toKop } from '@/domain/money'

const nbsp = / /g

describe('toKop', () => {
  it('переводить рядок у копійки', () => {
    expect(toKop('1234.56')).toBe(123456)
  })

  it('не втрачає копійку на float 1234.56', () => {
    // 1234.56 * 100 === 123455.99999999999 у чистому JS
    expect(toKop(1234.56)).toBe(123456)
  })

  it('обробляє один знак після коми', () => {
    expect(toKop('0.1')).toBe(10)
  })

  it('відхиляє три знаки після коми', () => {
    expect(() => toKop('1234.567')).toThrow(InvalidAmountError)
  })

  it('відхиляє відʼємну суму', () => {
    expect(() => toKop('-5')).toThrow(InvalidAmountError)
  })
})

describe('fromKop', () => {
  it('повертає рядок із двома знаками', () => {
    expect(fromKop(123456)).toBe('1234.56')
    expect(fromKop(5)).toBe('0.05')
  })
})

describe('roundHalfUp', () => {
  it('округлює 0.5 вгору', () => {
    expect(roundHalfUp(new Decimal('0.5'))).toBe(1)
  })

  it('округлює 1.4 вниз', () => {
    expect(roundHalfUp(new Decimal('1.4'))).toBe(1)
  })

  it('округлює 2.5 вгору, а не до парного', () => {
    // банківське округлення дало б 2 — нам потрібне 3
    expect(roundHalfUp(new Decimal('2.5'))).toBe(3)
  })
})

describe('formatUah', () => {
  it('форматує українською з групуванням', () => {
    expect(formatUah(123456).replace(nbsp, ' ')).toBe('1 234,56 грн')
  })
})
```

- [ ] **Step 3: Запустити тести і переконатися, що падають**

Run: `npm test -- tests/domain/money.test.ts`
Expected: FAIL — `Cannot find module '@/domain/money'`

- [ ] **Step 4: Реалізувати money.ts**

`src/domain/money.ts`:
```ts
import { Decimal } from 'decimal.js'
import { InvalidAmountError } from './errors'
import type { Kop } from './types'

/**
 * Гривні → копійки. Приймає рядок або число.
 * decimal.js будує значення з десяткового представлення числа,
 * тому float-похибки множення (1234.56 * 100) не виникає.
 */
export function toKop(uah: string | number): Kop {
  let value: Decimal
  try {
    value = new Decimal(uah)
  } catch {
    throw new InvalidAmountError(`Некоректна сума: ${uah}`)
  }

  if (value.isNegative()) {
    throw new InvalidAmountError(`Сума не може бути відʼємною: ${uah}`)
  }

  const kop = value.times(100)
  if (!kop.isInteger()) {
    throw new InvalidAmountError(`Сума ${uah} має більше двох знаків після коми`)
  }

  return kop.toNumber()
}

/** Копійки → рядок гривень із двома знаками, без розділювачів. */
export function fromKop(kop: Kop): string {
  return new Decimal(kop).dividedBy(100).toFixed(2)
}

/** Копійки → '1 234,56 грн' (нерозривний пробіл як розділювач тисяч). */
export function formatUah(kop: Kop): string {
  const uah = new Decimal(kop).dividedBy(100).toNumber()
  const formatted = new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(uah)
  return `${formatted} грн`
}

/** Єдина точка округлення в системі. Half-up, не банківське. */
export function roundHalfUp(value: Decimal): Kop {
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}
```

- [ ] **Step 5: Запустити тести і переконатися, що проходять**

Run: `npm test -- tests/domain/money.test.ts`
Expected: PASS — 10 passed

- [ ] **Step 6: Коміт**

```bash
git add -A
git commit -m "feat(domain): гроші в цілих копійках, округлення half-up

toKop будує Decimal із десяткового представлення, тому 1234.56
не втрачає копійку. Тест на 2.5 -> 3 фіксує саме half-up,
а не банківське округлення."
```

---

### Task 4: Споживання і заміна лічильника

**Files:**
- Create: `src/domain/consumption.ts`
- Test: `tests/domain/consumption.test.ts`

**Interfaces:**
- Consumes: `MeterSideInput` (Task 3), `NoPreviousReadingError`,
  `NegativeConsumptionError` (Task 3)
- Produces: `consumption(side: MeterSideInput): Decimal`

- [ ] **Step 1: Написати падаючі тести**

`tests/domain/consumption.test.ts`:
```ts
import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { consumption } from '@/domain/consumption'
import { NegativeConsumptionError, NoPreviousReadingError } from '@/domain/errors'
import type { MeterSideInput } from '@/domain/types'

const side = (o: Partial<MeterSideInput>): MeterSideInput => ({
  curr: new Decimal(0),
  prev: null,
  replaced: false,
  replacedInitial: null,
  ...o,
})

describe('consumption', () => {
  it('віднімає попередній показник від поточного', () => {
    const used = consumption(side({ curr: new Decimal(150), prev: new Decimal(100) }))
    expect(used.toString()).toBe('50')
  })

  it('працює з дробовими показниками води', () => {
    const used = consumption(side({ curr: new Decimal('12.750'), prev: new Decimal('9.250') }))
    expect(used.toString()).toBe('3.5')
  })

  it('падає, якщо попереднього показника немає', () => {
    expect(() => consumption(side({ curr: new Decimal(150) })))
      .toThrow(NoPreviousReadingError)
  })

  it('падає на відʼємному споживанні без заміни лічильника', () => {
    expect(() => consumption(side({ curr: new Decimal(90), prev: new Decimal(100) })))
      .toThrow(NegativeConsumptionError)
  })

  it('при заміні лічильника рахує від нуля, ігноруючи старий показник', () => {
    const used = consumption(side({
      curr: new Decimal(30),
      prev: new Decimal(900),
      replaced: true,
      replacedInitial: new Decimal(0),
    }))
    expect(used.toString()).toBe('30')
  })

  it('при заміні рахує від початкового показника нового лічильника', () => {
    const used = consumption(side({
      curr: new Decimal(30),
      prev: new Decimal(900),
      replaced: true,
      replacedInitial: new Decimal(5),
    }))
    expect(used.toString()).toBe('25')
  })

  it('при заміні без вказаного початкового показника вважає його нулем', () => {
    const used = consumption(side({
      curr: new Decimal(30),
      prev: new Decimal(900),
      replaced: true,
      replacedInitial: null,
    }))
    expect(used.toString()).toBe('30')
  })

  it('падає, якщо поточний менший за початковий показник нового лічильника', () => {
    expect(() => consumption(side({
      curr: new Decimal(3),
      prev: null,
      replaced: true,
      replacedInitial: new Decimal(5),
    }))).toThrow(NegativeConsumptionError)
  })
})
```

- [ ] **Step 2: Запустити тести і переконатися, що падають**

Run: `npm test -- tests/domain/consumption.test.ts`
Expected: FAIL — `Cannot find module '@/domain/consumption'`

- [ ] **Step 3: Реалізувати consumption.ts**

`src/domain/consumption.ts`:
```ts
import { Decimal } from 'decimal.js'
import { NegativeConsumptionError, NoPreviousReadingError } from './errors'
import type { MeterSideInput } from './types'

/**
 * Споживання за місяць.
 *
 * Якщо лічильник міняли, базою є початковий показник нового лічильника
 * (зазвичай нуль), а не останній показник старого — інакше споживання
 * вийшло б відʼємним.
 */
export function consumption(side: MeterSideInput): Decimal {
  const base = side.replaced
    ? (side.replacedInitial ?? new Decimal(0))
    : side.prev

  if (base === null) {
    throw new NoPreviousReadingError()
  }

  const used = side.curr.minus(base)
  if (used.isNegative()) {
    throw new NegativeConsumptionError(used.toString())
  }

  return used
}
```

- [ ] **Step 4: Запустити тести і переконатися, що проходять**

Run: `npm test -- tests/domain/consumption.test.ts`
Expected: PASS — 8 passed

- [ ] **Step 5: Коміт**

```bash
git add -A
git commit -m "feat(domain): споживання з підтримкою заміни лічильника

Без гілки replaced перший рахунок після заміни лічильника був би
відʼємним, а без NoPreviousReadingError — рахувався б від нуля
за весь час життя лічильника."
```

---

### Task 5: Побудова рядків рахунку

**Files:**
- Create: `src/domain/invoice.ts`
- Test: `tests/domain/invoice.test.ts`

**Interfaces:**
- Consumes: `consumption` (Task 4), `roundHalfUp` (Task 3),
  `MeterSideInput`, `LeaseTerms`, `TariffRates`, `InvoiceLines` (Task 3)
- Produces:
  - `interface BuildInvoiceInput { electricity: MeterSideInput; water: MeterSideInput; terms: LeaseTerms; rates: TariffRates }`
  - `buildInvoice(input: BuildInvoiceInput): InvoiceLines`

- [ ] **Step 1: Написати падаючі тести**

`tests/domain/invoice.test.ts`:
```ts
import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { buildInvoice, type BuildInvoiceInput } from '@/domain/invoice'

const input = (o: Partial<BuildInvoiceInput> = {}): BuildInvoiceInput => ({
  electricity: {
    curr: new Decimal(150), prev: new Decimal(100),
    replaced: false, replacedInitial: null,
  },
  water: {
    curr: new Decimal('12.5'), prev: new Decimal('9'),
    replaced: false, replacedInitial: null,
  },
  terms: { rentKop: 1_000_000, garbageKop: 30_000 },
  rates: { electricityRateKop: 432, waterRateKop: 1250 },
  ...o,
})

describe('buildInvoice', () => {
  it('рахує рядки за споживанням і тарифами', () => {
    const lines = buildInvoice(input())

    expect(lines.electricityUsed.toString()).toBe('50')
    expect(lines.waterUsed.toString()).toBe('3.5')
    expect(lines.electricityKop).toBe(50 * 432)   // 21600
    expect(lines.waterKop).toBe(4375)             // 3.5 * 1250
    expect(lines.rentKop).toBe(1_000_000)
    expect(lines.garbageKop).toBe(30_000)
  })

  it('підсумок дорівнює сумі вже округлених рядків', () => {
    const lines = buildInvoice(input())
    expect(lines.totalKop).toBe(
      lines.rentKop + lines.electricityKop + lines.waterKop + lines.garbageKop,
    )
    expect(lines.totalKop).toBe(1_055_975)
  })

  it('округлює кожен рядок half-up', () => {
    const lines = buildInvoice(input({
      water: {
        curr: new Decimal('3.333'), prev: new Decimal(0),
        replaced: false, replacedInitial: null,
      },
    }))
    // 3.333 * 1250 = 4166.25 -> 4166
    expect(lines.waterKop).toBe(4166)
  })

  it('усі грошові поля лишаються цілими', () => {
    const lines = buildInvoice(input({
      electricity: {
        curr: new Decimal('137.77'), prev: new Decimal('11.11'),
        replaced: false, replacedInitial: null,
      },
    }))
    for (const v of [lines.electricityKop, lines.waterKop, lines.totalKop]) {
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('враховує заміну лічильника при побудові рахунку', () => {
    const lines = buildInvoice(input({
      electricity: {
        curr: new Decimal(30), prev: new Decimal(900),
        replaced: true, replacedInitial: new Decimal(0),
      },
    }))
    expect(lines.electricityKop).toBe(30 * 432)
  })
})
```

- [ ] **Step 2: Запустити тести і переконатися, що падають**

Run: `npm test -- tests/domain/invoice.test.ts`
Expected: FAIL — `Cannot find module '@/domain/invoice'`

- [ ] **Step 3: Реалізувати invoice.ts**

`src/domain/invoice.ts`:
```ts
import { consumption } from './consumption'
import { roundHalfUp } from './money'
import type { InvoiceLines, LeaseTerms, MeterSideInput, TariffRates } from './types'

export interface BuildInvoiceInput {
  electricity: MeterSideInput
  water: MeterSideInput
  terms: LeaseTerms
  rates: TariffRates
}

/**
 * Рядки рахунку за місяць.
 *
 * Кожен рядок округлюється до копійки окремо, а підсумок є сумою вже
 * округлених цілих. Тому загальна сума не «пливе» відносно рядків,
 * які бачить орендар у роздруківці.
 */
export function buildInvoice(input: BuildInvoiceInput): InvoiceLines {
  const electricityUsed = consumption(input.electricity)
  const waterUsed = consumption(input.water)

  const electricityKop = roundHalfUp(electricityUsed.times(input.rates.electricityRateKop))
  const waterKop = roundHalfUp(waterUsed.times(input.rates.waterRateKop))
  const { rentKop, garbageKop } = input.terms

  return {
    electricityUsed,
    waterUsed,
    rentKop,
    electricityKop,
    waterKop,
    garbageKop,
    totalKop: rentKop + electricityKop + waterKop + garbageKop,
  }
}
```

- [ ] **Step 4: Запустити тести і переконатися, що проходять**

Run: `npm test -- tests/domain/invoice.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Коміт**

```bash
git add -A
git commit -m "feat(domain): побудова рядків рахунку

Підсумок — сума округлених рядків, а не округлення суми."
```

---

### Task 6: FIFO-рознесення оплат

**Files:**
- Create: `src/domain/allocation.ts`
- Test: `tests/domain/allocation.test.ts`

**Interfaces:**
- Consumes: `InvoiceForAllocation`, `AllocationResult`, `InvoiceStatus`, `Kop` (Task 3)
- Produces: `allocatePayments(invoices: InvoiceForAllocation[], totalPaidKop: Kop): AllocationResult`

- [ ] **Step 1: Написати падаючі тести**

`tests/domain/allocation.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { allocatePayments } from '@/domain/allocation'
import type { InvoiceForAllocation } from '@/domain/types'

const inv = (id: string, year: number, month: number, totalKop: number): InvoiceForAllocation =>
  ({ id, year, month, totalKop, createdAt: new Date(Date.UTC(year, month - 1, 1)) })

describe('allocatePayments', () => {
  const jan = inv('jan', 2026, 1, 100_000)
  const feb = inv('feb', 2026, 2, 100_000)

  it('без оплат усі рахунки не оплачені', () => {
    const r = allocatePayments([jan, feb], 0)
    expect(r.byInvoiceId.get('jan')!.status).toBe('UNPAID')
    expect(r.byInvoiceId.get('feb')!.status).toBe('UNPAID')
    expect(r.advanceKop).toBe(0)
  })

  it('гасить найстаріший рахунок першим', () => {
    const r = allocatePayments([feb, jan], 100_000)
    expect(r.byInvoiceId.get('jan')!.status).toBe('PAID')
    expect(r.byInvoiceId.get('feb')!.status).toBe('UNPAID')
  })

  it('позначає частково оплачений рахунок', () => {
    const r = allocatePayments([jan, feb], 40_000)
    expect(r.byInvoiceId.get('jan')).toEqual({ coveredKop: 40_000, status: 'PARTIAL' })
    expect(r.byInvoiceId.get('feb')!.status).toBe('UNPAID')
  })

  it('однією сумою гасить кілька місяців', () => {
    const r = allocatePayments([jan, feb], 200_000)
    expect(r.byInvoiceId.get('jan')!.status).toBe('PAID')
    expect(r.byInvoiceId.get('feb')!.status).toBe('PAID')
    expect(r.advanceKop).toBe(0)
  })

  it('надлишок стає авансом', () => {
    const r = allocatePayments([jan], 150_000)
    expect(r.byInvoiceId.get('jan')!.status).toBe('PAID')
    expect(r.advanceKop).toBe(50_000)
  })

  it('оплата без рахунків повністю стає авансом', () => {
    const r = allocatePayments([], 70_000)
    expect(r.advanceKop).toBe(70_000)
  })

  it('впорядковує рахунки за роком, потім за місяцем', () => {
    const dec2025 = inv('dec', 2025, 12, 100_000)
    const r = allocatePayments([jan, dec2025], 100_000)
    expect(r.byInvoiceId.get('dec')!.status).toBe('PAID')
    expect(r.byInvoiceId.get('jan')!.status).toBe('UNPAID')
  })

  it('не мутує вхідний масив', () => {
    const list = [feb, jan]
    allocatePayments(list, 0)
    expect(list[0]!.id).toBe('feb')
  })
})
```

- [ ] **Step 2: Запустити тести і переконатися, що падають**

Run: `npm test -- tests/domain/allocation.test.ts`
Expected: FAIL — `Cannot find module '@/domain/allocation'`

- [ ] **Step 3: Реалізувати allocation.ts**

`src/domain/allocation.ts`:
```ts
import type {
  AllocationEntry,
  AllocationResult,
  InvoiceForAllocation,
  InvoiceStatus,
  Kop,
} from './types'

/**
 * Розносить загальну суму оплат договору по його рахунках,
 * гасячи найстаріші першими.
 *
 * Статус рахунку ніде не зберігається — він завжди є результатом
 * цієї функції, тому не може розійтися з фактичними оплатами.
 */
export function allocatePayments(
  invoices: InvoiceForAllocation[],
  totalPaidKop: Kop,
): AllocationResult {
  const ordered = [...invoices].sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  )

  let pool = totalPaidKop
  const byInvoiceId = new Map<string, AllocationEntry>()

  for (const invoice of ordered) {
    const coveredKop = Math.min(pool, invoice.totalKop)
    pool -= coveredKop

    const status: InvoiceStatus =
      coveredKop === 0 ? 'UNPAID'
      : coveredKop < invoice.totalKop ? 'PARTIAL'
      : 'PAID'

    byInvoiceId.set(invoice.id, { coveredKop, status })
  }

  return { byInvoiceId, advanceKop: pool }
}
```

- [ ] **Step 4: Запустити тести і переконатися, що проходять**

Run: `npm test -- tests/domain/allocation.test.ts`
Expected: PASS — 8 passed

- [ ] **Step 5: Коміт**

```bash
git add -A
git commit -m "feat(domain): FIFO-рознесення оплат по рахунках"
```

---

### Task 7: Борг і аванс

**Files:**
- Create: `src/domain/debt.ts`
- Test: `tests/domain/debt.test.ts`

**Interfaces:**
- Consumes: `Kop` (Task 3)
- Produces:
  - `balanceKop(totalInvoicedKop: Kop, totalPaidKop: Kop): number` — додатнє = борг, відʼємне = аванс
  - `debtKop(totalInvoicedKop: Kop, totalPaidKop: Kop): Kop` — 0, якщо боргу немає
  - `advanceKop(totalInvoicedKop: Kop, totalPaidKop: Kop): Kop` — 0, якщо авансу немає

- [ ] **Step 1: Написати падаючі тести**

`tests/domain/debt.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { advanceKop, balanceKop, debtKop } from '@/domain/debt'

describe('balanceKop', () => {
  it('додатнє значення означає борг', () => {
    expect(balanceKop(200_000, 50_000)).toBe(150_000)
  })

  it('відʼємне значення означає аванс', () => {
    expect(balanceKop(100_000, 150_000)).toBe(-50_000)
  })
})

describe('debtKop', () => {
  it('повертає борг', () => {
    expect(debtKop(200_000, 50_000)).toBe(150_000)
  })

  it('не буває відʼємним при переплаті', () => {
    expect(debtKop(100_000, 150_000)).toBe(0)
  })
})

describe('advanceKop', () => {
  it('повертає переплату', () => {
    expect(advanceKop(100_000, 150_000)).toBe(50_000)
  })

  it('дорівнює нулю за наявності боргу', () => {
    expect(advanceKop(200_000, 50_000)).toBe(0)
  })
})
```

- [ ] **Step 2: Запустити тести і переконатися, що падають**

Run: `npm test -- tests/domain/debt.test.ts`
Expected: FAIL — `Cannot find module '@/domain/debt'`

- [ ] **Step 3: Реалізувати debt.ts**

`src/domain/debt.ts`:
```ts
import type { Kop } from './types'

/** Додатнє — борг, відʼємне — аванс. */
export function balanceKop(totalInvoicedKop: Kop, totalPaidKop: Kop): number {
  return totalInvoicedKop - totalPaidKop
}

export function debtKop(totalInvoicedKop: Kop, totalPaidKop: Kop): Kop {
  return Math.max(0, balanceKop(totalInvoicedKop, totalPaidKop))
}

export function advanceKop(totalInvoicedKop: Kop, totalPaidKop: Kop): Kop {
  return Math.max(0, -balanceKop(totalInvoicedKop, totalPaidKop))
}
```

- [ ] **Step 4: Запустити тести і переконатися, що проходять**

Run: `npm test -- tests/domain/debt.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: Коміт**

```bash
git add -A
git commit -m "feat(domain): борг і аванс"
```

---

### Task 8: Похідні статуси і межі місяця

Це задача, заради якої існує §3.8 спеки. Тест
«нарахування за минулий місяць по завершеному договорі» — регресія на баг,
який мав би місце при збереженому `Lease.status`.

**Files:**
- Create: `src/domain/status.ts`
- Test: `tests/domain/status.test.ts`

**Interfaces:**
- Consumes: `Period` (Task 3)
- Produces:
  - `type LeaseState = 'ACTIVE' | 'ENDED'`
  - `firstDayOfMonth(year: number, month: number): Date` — UTC
  - `lastDayOfMonth(year: number, month: number): Date` — UTC, кінець доби
  - `leaseState(period: Period, today: Date): LeaseState`
  - `isLeaseActiveInMonth(period: Period, year: number, month: number): boolean`
  - `isPremisesOccupied(leases: Period[], today: Date): boolean`

- [ ] **Step 1: Написати падаючі тести**

`tests/domain/status.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  firstDayOfMonth,
  isLeaseActiveInMonth,
  isPremisesOccupied,
  lastDayOfMonth,
  leaseState,
} from '@/domain/status'
import type { Period } from '@/domain/types'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

describe('межі місяця', () => {
  it('перший день', () => {
    expect(firstDayOfMonth(2026, 2).toISOString()).toBe('2026-02-01T00:00:00.000Z')
  })

  it('останній день лютого невисокосного року', () => {
    expect(lastDayOfMonth(2026, 2).toISOString()).toBe('2026-02-28T23:59:59.999Z')
  })

  it('останній день лютого високосного року', () => {
    expect(lastDayOfMonth(2028, 2).toISOString()).toBe('2028-02-29T23:59:59.999Z')
  })
})

describe('leaseState', () => {
  it('безстроковий договір активний', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: null }
    expect(leaseState(p, utc(2026, 7, 10))).toBe('ACTIVE')
  })

  it('договір із майбутньою датою завершення активний', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: utc(2026, 12, 31) }
    expect(leaseState(p, utc(2026, 7, 10))).toBe('ACTIVE')
  })

  it('договір із минулою датою завершення завершений', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: utc(2026, 3, 31) }
    expect(leaseState(p, utc(2026, 7, 10))).toBe('ENDED')
  })
})

describe('isLeaseActiveInMonth', () => {
  // Договір діяв січень-березень 2026 і вже завершився.
  const janToMar: Period = { startDate: utc(2026, 1, 1), endDate: utc(2026, 3, 31) }

  it('РЕГРЕСІЯ: завершений договір лишається чинним для лютого', () => {
    // Саме тут ховався баг: фільтр status = ACTIVE у квітні
    // мовчки викинув би цей договір із нарахування за лютий.
    expect(isLeaseActiveInMonth(janToMar, 2026, 2)).toBe(true)
  })

  it('не чинний для місяця після завершення', () => {
    expect(isLeaseActiveInMonth(janToMar, 2026, 4)).toBe(false)
  })

  it('не чинний для місяця до початку', () => {
    expect(isLeaseActiveInMonth(janToMar, 2025, 12)).toBe(false)
  })

  it('чинний у місяці початку, навіть якщо почався в останній день', () => {
    const p: Period = { startDate: utc(2026, 5, 31), endDate: null }
    expect(isLeaseActiveInMonth(p, 2026, 5)).toBe(true)
  })

  it('чинний у місяці завершення, навіть якщо завершився першого числа', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: utc(2026, 6, 1) }
    expect(isLeaseActiveInMonth(p, 2026, 6)).toBe(true)
  })

  it('безстроковий договір чинний у будь-якому місяці після початку', () => {
    const p: Period = { startDate: utc(2026, 1, 1), endDate: null }
    expect(isLeaseActiveInMonth(p, 2030, 11)).toBe(true)
  })
})

describe('isPremisesOccupied', () => {
  const today = utc(2026, 7, 10)

  it('приміщення без договорів вільне', () => {
    expect(isPremisesOccupied([], today)).toBe(false)
  })

  it('приміщення із чинним договором здане', () => {
    expect(isPremisesOccupied([{ startDate: utc(2026, 1, 1), endDate: null }], today)).toBe(true)
  })

  it('приміщення лише із завершеним договором вільне', () => {
    expect(isPremisesOccupied([{ startDate: utc(2026, 1, 1), endDate: utc(2026, 3, 31) }], today))
      .toBe(false)
  })

  it('приміщення з договором, що почнеться в майбутньому, поки вільне', () => {
    expect(isPremisesOccupied([{ startDate: utc(2026, 9, 1), endDate: null }], today)).toBe(false)
  })
})
```

- [ ] **Step 2: Запустити тести і переконатися, що падають**

Run: `npm test -- tests/domain/status.test.ts`
Expected: FAIL — `Cannot find module '@/domain/status'`

- [ ] **Step 3: Реалізувати status.ts**

`src/domain/status.ts`:
```ts
import type { Period } from './types'

export type LeaseState = 'ACTIVE' | 'ENDED'

/** Усі межі рахуються в UTC, щоб місцевий часовий пояс не зсував місяць. */
export function firstDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
}

export function lastDayOfMonth(year: number, month: number): Date {
  // Нульовий день наступного місяця — останній день поточного.
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
}

/** endDate включно: договір, що завершується сьогодні, ще активний. */
export function leaseState(period: Period, today: Date): LeaseState {
  if (period.endDate === null) return 'ACTIVE'
  return period.endDate.getTime() >= today.getTime() ? 'ACTIVE' : 'ENDED'
}

/**
 * Чи діяв договір у вказаному місяці.
 *
 * Визначається ВИКЛЮЧНО датами. Завершений договір лишається чинним для
 * тих місяців, у яких він діяв, — інакше нарахування заднім числом за
 * минулий місяць мовчки пропускало б такий договір.
 */
export function isLeaseActiveInMonth(period: Period, year: number, month: number): boolean {
  const monthStart = firstDayOfMonth(year, month)
  const monthEnd = lastDayOfMonth(year, month)

  const startsInTime = period.startDate.getTime() <= monthEnd.getTime()
  const endsInTime = period.endDate === null || period.endDate.getTime() >= monthStart.getTime()

  return startsInTime && endsInTime
}

/** Здане, якщо існує договір, що вже почався і ще не завершився. */
export function isPremisesOccupied(leases: Period[], today: Date): boolean {
  return leases.some(
    (lease) =>
      lease.startDate.getTime() <= today.getTime() && leaseState(lease, today) === 'ACTIVE',
  )
}
```

- [ ] **Step 4: Запустити тести і переконатися, що проходять**

Run: `npm test -- tests/domain/status.test.ts`
Expected: PASS — 16 passed

- [ ] **Step 5: Коміт**

```bash
git add -A
git commit -m "feat(domain): похідні статуси договору і приміщення

Активність договору в місяці визначається тільки датами.
Регресійний тест фіксує: завершений договір лишається чинним
для місяців, у яких він діяв."
```

---

### Task 9: Перетин періодів договорів

**Files:**
- Create: `src/domain/overlap.ts`
- Test: `tests/domain/overlap.test.ts`

**Interfaces:**
- Consumes: `Period` (Task 3)
- Produces:
  - `periodsOverlap(a: Period, b: Period): boolean`
  - `hasOverlap(existing: Period[], candidate: Period): boolean`

- [ ] **Step 1: Написати падаючі тести**

`tests/domain/overlap.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { hasOverlap, periodsOverlap } from '@/domain/overlap'
import type { Period } from '@/domain/types'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const p = (from: Date, to: Date | null): Period => ({ startDate: from, endDate: to })

describe('periodsOverlap', () => {
  it('послідовні періоди не перетинаються', () => {
    const a = p(utc(2026, 1, 1), utc(2026, 3, 31))
    const b = p(utc(2026, 4, 1), utc(2026, 6, 30))
    expect(periodsOverlap(a, b)).toBe(false)
  })

  it('дотик у той самий день є перетином', () => {
    // endDate включно, тому 31 березня зайняте обома договорами
    const a = p(utc(2026, 1, 1), utc(2026, 3, 31))
    const b = p(utc(2026, 3, 31), utc(2026, 6, 30))
    expect(periodsOverlap(a, b)).toBe(true)
  })

  it('вкладений період перетинається', () => {
    const a = p(utc(2026, 1, 1), utc(2026, 12, 31))
    const b = p(utc(2026, 5, 1), utc(2026, 6, 1))
    expect(periodsOverlap(a, b)).toBe(true)
  })

  it('безстроковий період перетинає будь-який пізніший', () => {
    const a = p(utc(2026, 1, 1), null)
    const b = p(utc(2030, 1, 1), utc(2030, 6, 1))
    expect(periodsOverlap(a, b)).toBe(true)
  })

  it('два безстрокові періоди завжди перетинаються', () => {
    expect(periodsOverlap(p(utc(2026, 1, 1), null), p(utc(2027, 1, 1), null))).toBe(true)
  })

  it('симетрична: порядок аргументів не впливає', () => {
    const a = p(utc(2026, 1, 1), utc(2026, 3, 31))
    const b = p(utc(2026, 3, 1), utc(2026, 6, 30))
    expect(periodsOverlap(a, b)).toBe(periodsOverlap(b, a))
  })
})

describe('hasOverlap', () => {
  const existing = [
    p(utc(2026, 1, 1), utc(2026, 3, 31)),
    p(utc(2026, 7, 1), utc(2026, 9, 30)),
  ]

  it('дозволяє договір у вільному проміжку', () => {
    expect(hasOverlap(existing, p(utc(2026, 4, 1), utc(2026, 6, 30)))).toBe(false)
  })

  it('відхиляє договір, що накладається на наявний', () => {
    expect(hasOverlap(existing, p(utc(2026, 3, 1), utc(2026, 5, 1)))).toBe(true)
  })

  it('порожній список наявних договорів не дає перетину', () => {
    expect(hasOverlap([], p(utc(2026, 1, 1), null))).toBe(false)
  })
})
```

- [ ] **Step 2: Запустити тести і переконатися, що падають**

Run: `npm test -- tests/domain/overlap.test.ts`
Expected: FAIL — `Cannot find module '@/domain/overlap'`

- [ ] **Step 3: Реалізувати overlap.ts**

`src/domain/overlap.ts`:
```ts
import type { Period } from './types'

const endOf = (period: Period): number =>
  period.endDate === null ? Number.POSITIVE_INFINITY : period.endDate.getTime()

/**
 * Періоди перетинаються, якщо кожен починається не пізніше,
 * ніж закінчується інший. endDate вважається включним.
 */
export function periodsOverlap(a: Period, b: Period): boolean {
  return a.startDate.getTime() <= endOf(b) && b.startDate.getTime() <= endOf(a)
}

/** Перевіряється проти УСІХ договорів приміщення — статусу в них немає. */
export function hasOverlap(existing: Period[], candidate: Period): boolean {
  return existing.some((period) => periodsOverlap(period, candidate))
}
```

- [ ] **Step 4: Запустити тести і переконатися, що проходять**

Run: `npm test -- tests/domain/overlap.test.ts`
Expected: PASS — 9 passed

- [ ] **Step 5: Коміт**

```bash
git add -A
git commit -m "feat(domain): перетин періодів договорів"
```

---

### Task 10: Вибір попереднього показника і чинного тарифу

Дві чисті функції, які §5.1 і §3.4 спеки описують як правила з грошовими
наслідками. Їхнє місце — у тестованому домені, а не всередині обробника запиту.

**Files:**
- Create: `src/domain/readings.ts`, `src/domain/tariff.ts`
- Test: `tests/domain/readings.test.ts`, `tests/domain/tariff.test.ts`

**Interfaces:**
- Consumes: `lastDayOfMonth` (Task 8), `TariffRates` (Task 3)
- Produces:
  - `interface MonthPoint { year: number; month: number }`
  - `findPreviousReading<T extends MonthPoint>(readings: T[], year: number, month: number): T | null`
  - `interface TariffRecord extends TariffRates { effectiveFrom: Date }`
  - `pickTariffForMonth(tariffs: TariffRecord[], year: number, month: number): TariffRecord | null`

- [ ] **Step 1: Написати падаючі тести на вибір показника**

`tests/domain/readings.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { findPreviousReading } from '@/domain/readings'

const r = (year: number, month: number) => ({ year, month })

describe('findPreviousReading', () => {
  it('повертає показник попереднього місяця', () => {
    const found = findPreviousReading([r(2026, 4), r(2026, 5)], 2026, 6)
    expect(found).toEqual(r(2026, 5))
  })

  it('перестрибує дірку в даних', () => {
    // Квітня і травня немає — беремо березень, а не падаємо
    const found = findPreviousReading([r(2026, 3), r(2026, 6)], 2026, 6)
    expect(found).toEqual(r(2026, 3))
  })

  it('перетинає межу року', () => {
    const found = findPreviousReading([r(2025, 12)], 2026, 1)
    expect(found).toEqual(r(2025, 12))
  })

  it('ігнорує показник самого розрахункового місяця', () => {
    expect(findPreviousReading([r(2026, 6)], 2026, 6)).toBeNull()
  })

  it('ігнорує пізніші показники', () => {
    expect(findPreviousReading([r(2026, 7), r(2026, 8)], 2026, 6)).toBeNull()
  })

  it('повертає null, якщо ранішого показника немає', () => {
    expect(findPreviousReading([], 2026, 6)).toBeNull()
  })
})
```

- [ ] **Step 2: Написати падаючі тести на вибір тарифу**

`tests/domain/tariff.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { pickTariffForMonth, type TariffRecord } from '@/domain/tariff'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

const jan: TariffRecord = {
  effectiveFrom: utc(2026, 1, 1), electricityRateKop: 432, waterRateKop: 1250,
}
const midMarch: TariffRecord = {
  effectiveFrom: utc(2026, 3, 15), electricityRateKop: 480, waterRateKop: 1375,
}

describe('pickTariffForMonth', () => {
  it('бере тариф, чинний на кінець місяця', () => {
    // Тариф набув чинності 15 березня — до березня він застосовується
    expect(pickTariffForMonth([jan, midMarch], 2026, 3)).toEqual(midMarch)
  })

  it('для попереднього місяця бере старий тариф', () => {
    expect(pickTariffForMonth([jan, midMarch], 2026, 2)).toEqual(jan)
  })

  it('для пізнішого місяця лишає новий тариф', () => {
    expect(pickTariffForMonth([jan, midMarch], 2026, 9)).toEqual(midMarch)
  })

  it('не залежить від порядку у вхідному масиві', () => {
    expect(pickTariffForMonth([midMarch, jan], 2026, 2)).toEqual(jan)
  })

  it('повертає null, якщо жоден тариф ще не діяв', () => {
    expect(pickTariffForMonth([jan], 2025, 12)).toBeNull()
  })

  it('повертає null на порожньому списку', () => {
    expect(pickTariffForMonth([], 2026, 6)).toBeNull()
  })
})
```

- [ ] **Step 3: Запустити тести і переконатися, що падають**

Run: `npm test -- tests/domain/readings.test.ts tests/domain/tariff.test.ts`
Expected: FAIL — `Cannot find module '@/domain/readings'`

- [ ] **Step 4: Реалізувати обидва модулі**

`src/domain/readings.ts`:
```ts
export interface MonthPoint {
  year: number
  month: number
}

/** Порядковий номер місяця — щоб порівнювати без роботи з датами. */
const ordinal = (p: MonthPoint): number => p.year * 12 + p.month

/**
 * Останній показник, знятий РАНІШЕ розрахункового місяця.
 *
 * Це не «місяць мінус один»: якщо в даних дірка, беремо найсвіжіший
 * наявний запис. Інакше пропущений місяць ламав би нарахування.
 */
export function findPreviousReading<T extends MonthPoint>(
  readings: T[],
  year: number,
  month: number,
): T | null {
  const target = ordinal({ year, month })
  const earlier = readings.filter((r) => ordinal(r) < target)

  if (earlier.length === 0) return null

  return earlier.reduce((best, r) => (ordinal(r) > ordinal(best) ? r : best))
}
```

`src/domain/tariff.ts`:
```ts
import { lastDayOfMonth } from './status'
import type { TariffRates } from './types'

export interface TariffRecord extends TariffRates {
  effectiveFrom: Date
}

/**
 * Тариф, чинний на ОСТАННІЙ день розрахункового місяця.
 *
 * Показники знімають наприкінці місяця, тому діє та ставка, що вже
 * набула чинності. Пропорційний поділ місяця між тарифами не робимо.
 */
export function pickTariffForMonth(
  tariffs: TariffRecord[],
  year: number,
  month: number,
): TariffRecord | null {
  const monthEnd = lastDayOfMonth(year, month).getTime()
  const eligible = tariffs.filter((t) => t.effectiveFrom.getTime() <= monthEnd)

  if (eligible.length === 0) return null

  return eligible.reduce((best, t) =>
    t.effectiveFrom.getTime() > best.effectiveFrom.getTime() ? t : best,
  )
}
```

- [ ] **Step 5: Запустити тести і переконатися, що проходять**

Run: `npm test -- tests/domain/readings.test.ts tests/domain/tariff.test.ts`
Expected: PASS — 12 passed

- [ ] **Step 6: Коміт**

```bash
git add -A
git commit -m "feat(domain): вибір попереднього показника і чинного тарифу

Попередній показник — останній РАНІШЕ місяця, а не місяць мінус один:
дірка в даних не повинна ламати нарахування. Тариф береться чинний
на кінець місяця, тому зміна від 15 березня діє вже за березень."
```

---

### Task 11: Seed із тестовими даними

**Files:**
- Create: `prisma/seed-data.ts`, `prisma/seed.ts`
- Test: `tests/seed.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `toKop` (Task 3), `isLeaseActiveInMonth` (Task 8)
- Produces: `seed(): Promise<void>` з `prisma/seed-data.ts`; заповнена БД:
  1 адмін, 2 локації, 3 приміщення, 2 орендарі, 2 договори, 2 тарифи,
  показники за 2 місяці (травень і червень 2026)

Логіка винесена в `seed-data.ts` окремо від CLI-обгортки, щоб тест міг
викликати `seed()` напряму і не залежати від порядку запуску файлів.

Показники за **два** місяці обовʼязкові: без попереднього показника
нарахування за червень не сформується (§5.5 спеки).

- [ ] **Step 1: Написати seed-логіку**

`prisma/seed-data.ts` (відносні імпорти — під `tsx` alias `@/` не працює):
```ts
import bcrypt from 'bcryptjs'
import { toKop } from '../src/domain/money'
import { prisma } from '../src/server/db'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

export async function seed() {
  // Порядок видалення поважає зовнішні ключі
  await prisma.payment.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.meterReading.deleteMany()
  await prisma.lease.deleteMany()
  await prisma.premises.deleteMany()
  await prisma.location.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.tariff.deleteMany()
  await prisma.user.deleteMany()

  await prisma.user.create({
    data: {
      email: 'admin@rent.ksm.in.ua',
      passwordHash: await bcrypt.hash('admin12345', 10),
      name: 'Адміністратор',
      role: 'ADMIN',
    },
  })

  const east = await prisma.location.create({
    data: { name: 'БЦ Схід', address: 'вул. Хрещатик, 12, Київ' },
  })
  const depot = await prisma.location.create({
    data: { name: 'Склад Лівобережний', address: 'вул. Промислова, 5, Київ' },
  })

  const office204 = await prisma.premises.create({
    data: { locationId: east.id, unitNumber: '204', type: 'офіс', floor: 2, areaM2: '54.30' },
  })
  const retail101 = await prisma.premises.create({
    data: { locationId: east.id, unitNumber: '101', type: 'ритейл', floor: 1, areaM2: '88.00' },
  })
  await prisma.premises.create({
    data: { locationId: depot.id, unitNumber: 'A-1', type: 'склад', floor: 1, areaM2: '240.00' },
  })

  const kavaMisto = await prisma.tenant.create({
    data: { name: 'ТОВ «Кава Місто»', phone: '+380671234567', taxCode: '12345678' },
  })
  const softLab = await prisma.tenant.create({
    data: { name: 'ФОП Іваненко І. І.', phone: '+380509876543', taxCode: '2345678901' },
  })

  await prisma.lease.create({
    data: {
      premisesId: office204.id,
      tenantId: softLab.id,
      startDate: utc(2026, 1, 1),
      endDate: null,
      rentKop: toKop('18000.00'),
      garbageKop: toKop('300.00'),
    },
  })
  await prisma.lease.create({
    data: {
      premisesId: retail101.id,
      tenantId: kavaMisto.id,
      startDate: utc(2026, 3, 1),
      endDate: utc(2027, 2, 28),
      rentKop: toKop('42000.00'),
      garbageKop: toKop('550.00'),
    },
  })

  // Історія тарифів: старий діє з січня, новий — із червня
  await prisma.tariff.create({
    data: {
      effectiveFrom: utc(2026, 1, 1),
      electricityRateKop: toKop('4.32'),
      waterRateKop: toKop('12.50'),
    },
  })
  await prisma.tariff.create({
    data: {
      effectiveFrom: utc(2026, 6, 1),
      electricityRateKop: toKop('4.80'),
      waterRateKop: toKop('13.75'),
    },
  })

  // Два місяці показників: травень дає базу, червень — розрахунковий місяць
  const readings = [
    { premisesId: office204.id, year: 2026, month: 5, electricity: '1250.0', water: '48.500' },
    { premisesId: office204.id, year: 2026, month: 6, electricity: '1418.0', water: '52.250' },
    { premisesId: retail101.id, year: 2026, month: 5, electricity: '3110.0', water: '133.000' },
    { premisesId: retail101.id, year: 2026, month: 6, electricity: '3475.0', water: '141.750' },
  ]
  for (const r of readings) {
    await prisma.meterReading.create({ data: { ...r, readAt: utc(r.year, r.month, 28) } })
  }

  console.log('Seed виконано: admin@rent.ksm.in.ua / admin12345')
}
```

`prisma/seed.ts` — тонка CLI-обгортка:
```ts
import { prisma } from '../src/server/db'
import { seed } from './seed-data'

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Запустити seed**

Run: `npm run db:seed`
Expected: `Seed виконано: admin@rent.ksm.in.ua / admin12345`

- [ ] **Step 3: Написати падаючий тест, що перевіряє форму даних**

`tests/seed.test.ts`:
```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../prisma/seed-data'
import { isLeaseActiveInMonth } from '@/domain/status'
import { prisma } from '@/server/db'

// Тест сам наповнює базу, тому не залежить від того, чи запускали
// `npm run db:seed` руками і в якому порядку йдуть файли тестів.
beforeAll(async () => {
  await seed()
})

describe('seed', () => {
  it('створює очікуваний набір сутностей', async () => {
    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.location.count()).toBe(2)
    expect(await prisma.premises.count()).toBe(3)
    expect(await prisma.tenant.count()).toBe(2)
    expect(await prisma.lease.count()).toBe(2)
    expect(await prisma.tariff.count()).toBe(2)
    expect(await prisma.meterReading.count()).toBe(4)
  })

  it('зберігає гроші як цілі копійки', async () => {
    const lease = await prisma.lease.findFirstOrThrow({ orderBy: { rentKop: 'asc' } })
    expect(lease.rentKop).toBe(1_800_000)
    expect(Number.isInteger(lease.rentKop)).toBe(true)
  })

  it('дає кожному приміщенню з договором дві точки показників', async () => {
    const leases = await prisma.lease.findMany()
    for (const lease of leases) {
      const count = await prisma.meterReading.count({ where: { premisesId: lease.premisesId } })
      expect(count).toBe(2)
    }
  })

  it('обидва договори чинні в червні 2026 — місяці, за який рахуватимемо', async () => {
    const leases = await prisma.lease.findMany()
    for (const lease of leases) {
      expect(isLeaseActiveInMonth(lease, 2026, 6)).toBe(true)
    }
  })
})
```

- [ ] **Step 4: Запустити тест**

Run: `npm test -- tests/seed.test.ts`
Expected: PASS — 4 passed (`beforeAll` наповнює базу сам)

- [ ] **Step 5: Прогнати всі тести разом**

Run: `npm test`
Expected: PASS — усі файли зелені, жодного пропущеного.
`fileParallelism: false` гарантує, що `seed.test.ts` не перетинається
з `db.test.ts` на одному файлі SQLite.

- [ ] **Step 6: Коміт**

```bash
git add -A
git commit -m "feat: seed із тестовими даними

Два місяці показників обовʼязкові: без попереднього показника
нарахування за червень не сформується. Історія тарифів містить
зміну з червня, щоб перевірити вибір тарифу на кінець місяця."
```

---

## Підсумок плану

Після Task 11 маємо:

- `npm test` — зелений, доменний шар покритий тестами;
- `npm run db:studio` — база із заповненими даними;
- жодного рядка UI, жодного HTTP-обробника — і при цьому вся грошова
  математика вже перевірена.

Наступний план (**План 2: Auth + API**) будує REST-шар поверх цього фундаменту
і використовує: `prisma` з `@/server/db`, `buildInvoice`, `allocatePayments`,
`findPreviousReading`, `pickTariffForMonth`, `isLeaseActiveInMonth`,
`hasOverlap`, `toKop`, `formatUah`.

Формування нарахувань (§5.5 спеки) складається саме з цих деталей:
`isLeaseActiveInMonth` відбирає договори, `findPreviousReading` дає базу,
`pickTariffForMonth` — ставки, `buildInvoice` — рядки. Обробник запиту лише
зшиває їх і повертає причини пропуску. Уся логіка вже під тестами.
