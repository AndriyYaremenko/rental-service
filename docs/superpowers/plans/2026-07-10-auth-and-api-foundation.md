# План 2a: Auth і фундамент API + довідкові CRUD

> **Для агентів:** ОБОВʼЯЗКОВИЙ СУБ-СКІЛ: `superpowers:subagent-driven-development`
> (рекомендовано) або `superpowers:executing-plans`. Кроки — чекбокси (`- [ ]`).

**Мета:** робочий REST-бекенд для авторизації та керування довідковими даними
(локації, приміщення, орендарі, тарифи, користувачі) поверх готового домену.

**Архітектура:** тонкі route-handler'и Next викликають **service-функції**, у яких
живе вся логіка й усі тести (це обходить те, що `cookies()` у Next 16 асинхронний і
недоступний у Vitest поза Next). Помилки — єдиний envelope за §6.1 спеки. Гроші в
API — цілі копійки (`Int`), `Decimal` (площа) серіалізується в рядок. Авторизація —
JWT (`jose`, HS256) у httpOnly-cookie, пароль — `bcryptjs`.

**Спека:** `docs/superpowers/specs/2026-07-10-rental-accounting-design.md` (§6 — API).
**Домен (План 1):** `src/domain/**` — уже готовий і протестований.

Це другий із чотирьох планів. Наступний — **2b: транзакційний API** (договори,
показники, нарахування, оплати, звіти).

## Global Constraints

Діють у **кожній** задачі.

- **Гроші — цілі копійки (`Int`).** У DTO API суми віддаються як `number` копійок;
  UI форматує сам. `Decimal` (лише площа) віддається як **рядок** (`.toString()`),
  бо Prisma.Decimal інакше серіалізується в `{s,e,d}`.
- **Формат помилки — рівно за §6.1:** `{ "error": { "code", "message", "fields"? } }`.
  Коди й HTTP: `VALIDATION_FAILED` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403,
  `NOT_FOUND` 404, `CONFLICT`/`LEASE_OVERLAP`/`INVOICE_EXISTS`/`READING_DECREASED` 409.
- **Уся логіка — у service-функціях; route-handler'и тонкі** (guard → parse → service
  → json). Тести цілять у services/core, не в HTTP-шар.
- **`cookies()`, `headers()`, `params` у Next 16 — асинхронні** (Promise, треба `await`).
  Сигнатура динамічного роуту: `(req, { params }: { params: Promise<{ id: string }> })`.
- **Типи Prisma — з `@/generated/prisma/client`** (реекспортує PrismaClient, `Prisma`,
  моделі, enum-и). Інстанс — `import { prisma } from '@/server/db'`.
- **Домен не змінюється.** API його лише споживає.
- Ідентифікатори англійською; повідомлення помилок і коміти українською.
- **TDD обовʼязковий** для service/core: падаючий тест → падіння → мінімальна
  реалізація → зелено → коміт. Route-handler'и — тонка склейка, перевіряються
  `npm run build` (типізація сигнатур) і code-review, юніт-тестами не покриваються.
- **Не оновлювати TypeScript до 7, Prisma-схему не чіпати** (див. План 1).
- Service-тести працюють проти реальної `prisma/dev.db` (є seed). Кожен тест
  **створює свої дані й прибирає їх** (`try/finally` або `afterEach`), а list-тести
  перевіряють **присутність**, не точну кількість — бо в базі є seed.
- **Кожна CRUD-задача обовʼязково має тести:** (а) `update`/`delete` неіснуючого id →
  `NOT_FOUND` (не 500 — без precheck Prisma кидає P2025, що падає в generic 500);
  (б) **форма DTO** — `Object.keys(dto).sort()` дорівнює точному набору полів, щоб
  `createdAt`/`updatedAt`/`passwordHash` не протекли у відповідь; (в) де є поле, що
  очищається (`notes` тощо) — сервіс персистить явний `null`; (г) **форма елемента
  `listX()`** — той самий `Object.keys().sort()` на елементі списку, бо `return rows`
  замість `rows.map(toDTO)` злив би сирі рядки саме через список-ендпоінт. Ці патерни —
  наслідок рев'ю Task 4 і Task 5; без них регресії проходять непоміченими.

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `src/server/http.ts` | `ApiError`, коди/статуси, `toErrorResponse`, `route()`, `json()`, `parseBody()` |
| `src/server/auth/password.ts` | `hashPassword`, `verifyPassword` (bcryptjs) |
| `src/server/auth/session.ts` | cookie-константи, `signSession`, `verifySession` (jose) |
| `src/server/auth/core.ts` | `authenticate`, `userFromToken` — чиста логіка без cookie |
| `src/server/auth/guard.ts` | `requireUser`, `requireAdmin` — читають cookie, тонкі |
| `src/server/services/*.ts` | `locations`, `premises`, `tenants`, `tariffs`, `users` — CRUD + DTO |
| `src/lib/validation/*.ts` | Zod-схеми: `common`, `auth`, `location`, `premises`, `tenant`, `tariff`, `user` |
| `src/app/api/**/route.ts` | тонкі handler'и |
| `tests/server/*`, `tests/services/*` | тести |

---

### Task 1: HTTP-інфраструктура — envelope помилок, `route()`, `parseBody`

**Files:**
- Create: `src/server/http.ts`
- Test: `tests/server/http.test.ts`

**Interfaces:**
- Consumes: `zod`
- Produces:
  - `type ApiErrorCode` (див. Global Constraints)
  - `class ApiError { code, message, fields?; get status }`
  - `toErrorResponse(e: unknown): { status: number; body: unknown }`
  - `route(fn): (req, ctx) => Promise<Response>` — ловить `ApiError`/`ZodError`/невідоме
  - `json(data: unknown, status?: number): NextResponse`
  - `parseBody<T>(req: Request, schema: ZodType<T>): Promise<T>` — кидає `VALIDATION_FAILED` з `fields`

- [ ] **Step 1: Написати падаючі тести**

`tests/server/http.test.ts`:
```ts
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { ApiError, parseBody, toErrorResponse } from '@/server/http'

const req = (body: unknown) =>
  new Request('http://t/api', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

describe('toErrorResponse', () => {
  it('ApiError → код, статус, повідомлення в envelope', () => {
    const { status, body } = toErrorResponse(new ApiError('LEASE_OVERLAP', 'Перетин', { startDate: 'зайнято' }))
    expect(status).toBe(409)
    expect(body).toEqual({ error: { code: 'LEASE_OVERLAP', message: 'Перетин', fields: { startDate: 'зайнято' } } })
  })

  it('ApiError без fields не додає порожнє поле', () => {
    const { body } = toErrorResponse(new ApiError('NOT_FOUND', 'Немає'))
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'Немає' } })
  })

  it('невідома помилка → 500 без витоку повідомлення', () => {
    const { status, body } = toErrorResponse(new Error('деталь стеку'))
    expect(status).toBe(500)
    expect(body).toEqual({ error: { code: 'INTERNAL', message: 'Внутрішня помилка сервера' } })
  })
})

describe('parseBody', () => {
  const schema = z.object({ name: z.string().min(1) })

  it('повертає розібрані дані', async () => {
    expect(await parseBody(req({ name: 'Оренда' }), schema)).toEqual({ name: 'Оренда' })
  })

  it('невалідне тіло → ApiError VALIDATION_FAILED із fields по шляху', async () => {
    await expect(parseBody(req({ name: '' }), schema)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { name: expect.any(String) },
    })
  })

  it('некоректний JSON → VALIDATION_FAILED', async () => {
    const bad = new Request('http://t/api', { method: 'POST', body: '{не json' })
    await expect(parseBody(bad, schema)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/server/http.test.ts`
Expected: FAIL — `Cannot find module '@/server/http'`

- [ ] **Step 3: Реалізувати `src/server/http.ts`**

```ts
import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LEASE_OVERLAP'
  | 'INVOICE_EXISTS'
  | 'READING_DECREASED'

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LEASE_OVERLAP: 409,
  INVOICE_EXISTS: 409,
  READING_DECREASED: 409,
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }

  get status(): number {
    return STATUS[this.code]
  }
}

function envelope(code: string, message: string, fields?: Record<string, string>) {
  return { error: fields ? { code, message, fields } : { code, message } }
}

export function toErrorResponse(e: unknown): { status: number; body: unknown } {
  if (e instanceof ApiError) {
    return { status: e.status, body: envelope(e.code, e.message, e.fields) }
  }
  if (e instanceof ZodError) {
    return { status: 400, body: envelope('VALIDATION_FAILED', 'Дані не пройшли валідацію', zodFields(e)) }
  }
  // Невідома помилка: не віддаємо стек/деталі назовні.
  return { status: 500, body: envelope('INTERNAL', 'Внутрішня помилка сервера') }
}

function zodFields(e: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of e.issues) {
    fields[issue.path.join('.') || '_'] = issue.message
  }
  return fields
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError('VALIDATION_FAILED', 'Тіло запиту не є коректним JSON')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new ApiError('VALIDATION_FAILED', 'Дані не пройшли валідацію', zodFields(result.error))
  }
  return result.data
}

// Ctx узагальнений, щоб динамічні роути (`[id]`) з `{ params: Promise<{id}> }`
// типізувалися під strict. За замовчуванням unknown (статичні роути).
type Handler<Ctx = unknown> = (req: import('next/server').NextRequest, ctx: Ctx) => Promise<Response>

/** Обгортка route-handler'а: перетворює будь-яку кинуту помилку в envelope. */
export function route<Ctx = unknown>(fn: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (e) {
      const { status, body } = toErrorResponse(e)
      return NextResponse.json(body, { status })
    }
  }
}
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/server/http.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: Коміт**

```bash
git add src/server/http.ts tests/server/http.test.ts
git commit -m "feat(api): HTTP-інфраструктура — envelope помилок, route(), parseBody

Єдиний формат помилки за §6.1. route() ловить ApiError і ZodError;
невідома помилка → 500 без витоку деталей. parseBody кладе помилки
Zod у fields по шляху поля."
```

---

### Task 2: Пароль і сесія

**Files:**
- Create: `src/server/auth/password.ts`, `src/server/auth/session.ts`
- Test: `tests/server/auth/password.test.ts`, `tests/server/auth/session.test.ts`

**Interfaces:**
- Consumes: `bcryptjs`, `jose`, `SESSION_SECRET` з `.env`
- Produces:
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`
  - `const SESSION_COOKIE = 'rs_session'`
  - `cookieOptions(): { httpOnly; sameSite; secure; path; maxAge }`
  - `interface SessionClaims { sub: string; role: 'ADMIN' | 'USER' }`
  - `signSession(claims: SessionClaims): Promise<string>`
  - `verifySession(token: string): Promise<SessionClaims | null>` — `null` на невалідному/простроченому

- [ ] **Step 1: Встановити jose**

```bash
npm install jose@6
```
`bcryptjs` уже встановлено (План 1). У bcryptjs 3.x типи вбудовані — окремий
`@types/bcryptjs` не потрібен; якщо `tsc` поскаржиться, встанови його.

- [ ] **Step 2: Написати падаючі тести**

`tests/server/auth/password.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/server/auth/password'

describe('пароль', () => {
  it('хеш не дорівнює відкритому паролю', async () => {
    const hash = await hashPassword('taemnytsia123')
    expect(hash).not.toBe('taemnytsia123')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('правильний пароль проходить перевірку', async () => {
    const hash = await hashPassword('taemnytsia123')
    expect(await verifyPassword('taemnytsia123', hash)).toBe(true)
  })

  it('неправильний пароль не проходить', async () => {
    const hash = await hashPassword('taemnytsia123')
    expect(await verifyPassword('inshyi', hash)).toBe(false)
  })
})
```

`tests/server/auth/session.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { signSession, verifySession } from '@/server/auth/session'

describe('сесія', () => {
  it('підписаний токен верифікується назад у ті самі claims', async () => {
    const token = await signSession({ sub: 'user_1', role: 'ADMIN' })
    expect(await verifySession(token)).toMatchObject({ sub: 'user_1', role: 'ADMIN' })
  })

  it('підроблений токен → null', async () => {
    const token = await signSession({ sub: 'user_1', role: 'USER' })
    expect(await verifySession(token + 'x')).toBeNull()
  })

  it('сміття замість токена → null, а не викид', async () => {
    expect(await verifySession('не-токен')).toBeNull()
  })
})
```

- [ ] **Step 3: Запустити — переконатися, що падає**

Run: `npm test -- tests/server/auth/`
Expected: FAIL — `Cannot find module '@/server/auth/password'`

- [ ] **Step 4: Реалізувати**

`src/server/auth/password.ts`:
```ts
import bcrypt from 'bcryptjs'

const ROUNDS = 10

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

`src/server/auth/session.ts`:
```ts
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'rs_session'
const ALG = 'HS256'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 днів

export interface SessionClaims {
  sub: string
  role: 'ADMIN' | 'USER'
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('SESSION_SECRET не задано')
  return new TextEncoder().encode(value)
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

/** null на будь-якій помилці верифікації (підпис, строк, формат). */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.sub !== 'string') return null
    const role = payload.role
    if (role !== 'ADMIN' && role !== 'USER') return null
    return { sub: payload.sub, role }
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Запустити — переконатися, що проходить**

Run: `npm test -- tests/server/auth/`
Expected: PASS — 6 passed

- [ ] **Step 6: Коміт**

```bash
git add src/server/auth/password.ts src/server/auth/session.ts \
  tests/server/auth/ package.json package-lock.json
git commit -m "feat(auth): хешування пароля (bcryptjs) і підпис сесії (jose)

JWT HS256 у httpOnly-cookie, строк 7 днів. verifySession повертає null
на будь-якій помилці, а не кидає — щоб guard не падав на сміттєвому cookie."
```

---

### Task 3: Автентифікація, guard і auth-роути

**Files:**
- Create: `src/server/auth/core.ts`, `src/server/auth/guard.ts`, `src/lib/validation/auth.ts`
- Create: `src/app/api/auth/login/route.ts`, `.../logout/route.ts`, `.../me/route.ts`
- Test: `tests/server/auth/core.test.ts`

**Interfaces:**
- Consumes: `prisma`, `verifyPassword`, `signSession`/`verifySession`, `SessionClaims`, `ApiError`
- Produces:
  - `interface SessionUser { id: string; email: string; name: string; role: 'ADMIN' | 'USER' }`
  - `authenticate(email: string, password: string): Promise<{ user: SessionUser; token: string }>` — кидає `ApiError('UNAUTHORIZED')` на невдачу
  - `userFromToken(token: string | undefined): Promise<SessionUser>` — кидає `ApiError('UNAUTHORIZED')`
  - `requireUser(): Promise<SessionUser>`, `requireAdmin(): Promise<SessionUser>` (читають cookie)

- [ ] **Step 1: Написати падаючі тести**

`tests/server/auth/core.test.ts`:
```ts
import { afterAll, describe, expect, it } from 'vitest'
import { authenticate, userFromToken } from '@/server/auth/core'
import { hashPassword } from '@/server/auth/password'
import { ApiError } from '@/server/http'
import { prisma } from '@/server/db'

const EMAIL = 'core-test@example.com'
let userId = ''

async function ensureUser(active = true) {
  const u = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { isActive: active },
    create: { email: EMAIL, name: 'Тест', role: 'USER', isActive: active, passwordHash: await hashPassword('pravylnyi1') },
  })
  userId = u.id
  return u
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } })
})

describe('authenticate', () => {
  it('правильні креденшели → user і токен', async () => {
    await ensureUser()
    const { user, token } = await authenticate(EMAIL, 'pravylnyi1')
    expect(user.email).toBe(EMAIL)
    expect(token.length).toBeGreaterThan(10)
  })

  it('неправильний пароль → UNAUTHORIZED', async () => {
    await ensureUser()
    await expect(authenticate(EMAIL, 'ne-toi')).rejects.toBeInstanceOf(ApiError)
  })

  it('неіснуючий email → UNAUTHORIZED (не розкриваємо, що саме не так)', async () => {
    await expect(authenticate('nikoho@example.com', 'bud-yaki')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('вимкнений користувач не входить', async () => {
    await ensureUser(false)
    await expect(authenticate(EMAIL, 'pravylnyi1')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('userFromToken', () => {
  it('валідний токен активного користувача → SessionUser', async () => {
    await ensureUser()
    const { token } = await authenticate(EMAIL, 'pravylnyi1')
    expect((await userFromToken(token)).email).toBe(EMAIL)
  })

  it('відсутній cookie → UNAUTHORIZED', async () => {
    await expect(userFromToken(undefined)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('користувача деактивували після видачі токена → UNAUTHORIZED', async () => {
    await ensureUser()
    const { token } = await authenticate(EMAIL, 'pravylnyi1')
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } })
    await expect(userFromToken(token)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/server/auth/core.test.ts`
Expected: FAIL — `Cannot find module '@/server/auth/core'`

- [ ] **Step 3: Реалізувати core**

`src/server/auth/core.ts`:
```ts
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { verifyPassword } from './password'
import { signSession, verifySession } from './session'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'USER'
}

const UNAUTHORIZED = () => new ApiError('UNAUTHORIZED', 'Потрібна авторизація')

function toSessionUser(u: { id: string; email: string; name: string; role: string }): SessionUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role === 'ADMIN' ? 'ADMIN' : 'USER' }
}

export async function authenticate(email: string, password: string): Promise<{ user: SessionUser; token: string }> {
  const user = await prisma.user.findUnique({ where: { email } })
  // Однакова помилка для «немає користувача» і «неправильний пароль» — не
  // розкриваємо, які email зареєстровані.
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    throw UNAUTHORIZED()
  }
  const sessionUser = toSessionUser(user)
  const token = await signSession({ sub: user.id, role: sessionUser.role })
  return { user: sessionUser, token }
}

export async function userFromToken(token: string | undefined): Promise<SessionUser> {
  if (!token) throw UNAUTHORIZED()
  const claims = await verifySession(token)
  if (!claims) throw UNAUTHORIZED()
  const user = await prisma.user.findUnique({ where: { id: claims.sub } })
  if (!user || !user.isActive) throw UNAUTHORIZED()
  return toSessionUser(user)
}
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/server/auth/core.test.ts`
Expected: PASS — 7 passed

- [ ] **Step 5: Реалізувати guard і auth-роути (тонка склейка, без юніт-тестів)**

`src/server/auth/guard.ts`:
```ts
import { cookies } from 'next/headers'
import { ApiError } from '@/server/http'
import { SESSION_COOKIE } from './session'
import { userFromToken, type SessionUser } from './core'

export async function requireUser(): Promise<SessionUser> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return userFromToken(token)
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') throw new ApiError('FORBIDDEN', 'Потрібні права адміністратора')
  return user
}
```

`src/lib/validation/auth.ts`:
```ts
import { z } from 'zod'

export const loginSchema = z.object({
  // Zod 4: email — top-level z.email(), НЕ застарілий z.string().email().
  email: z.email('Некоректний email'),
  password: z.string().min(1, 'Введіть пароль'),
})
```

> Якщо Zod 4 не прийме рядок-повідомлення в `z.email('...')`, візьми форму,
> яку приймає встановлена версія (`z.email({ error: '...' })`) — перевір у RED.

`src/app/api/auth/login/route.ts`:
```ts
import { cookies } from 'next/headers'
import { authenticate } from '@/server/auth/core'
import { SESSION_COOKIE, cookieOptions } from '@/server/auth/session'
import { json, parseBody, route } from '@/server/http'
import { loginSchema } from '@/lib/validation/auth'

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginSchema)
  const { user, token } = await authenticate(email, password)
  ;(await cookies()).set(SESSION_COOKIE, token, cookieOptions())
  return json(user)
})
```

`src/app/api/auth/logout/route.ts`:
```ts
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/server/auth/session'
import { json, route } from '@/server/http'

export const POST = route(async () => {
  ;(await cookies()).delete(SESSION_COOKIE)
  return json({ ok: true })
})
```

`src/app/api/auth/me/route.ts`:
```ts
import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'

export const GET = route(async () => {
  return json(await requireUser())
})
```

- [ ] **Step 6: Перевірити збірку**

Run: `npm run build`
Expected: збірка успішна; у списку маршрутів `/api/auth/login`, `/logout`, `/me`.

- [ ] **Step 7: Коміт**

```bash
git add src/server/auth/core.ts src/server/auth/guard.ts src/lib/validation/auth.ts \
  src/app/api/auth tests/server/auth/core.test.ts
git commit -m "feat(auth): authenticate, guard і роути login/logout/me

authenticate дає однакову помилку для неіснуючого email і неправильного
пароля. userFromToken перевіряє isActive щоразу — деактивований користувач
втрачає доступ негайно, не чекаючи закінчення токена."
```

---

### Task 4: Валідація-інфраструктура + локації (CRUD)

**Files:**
- Create: `src/lib/validation/common.ts`, `src/lib/validation/location.ts`, `src/server/services/locations.ts`
- Create: `src/app/api/locations/route.ts`, `src/app/api/locations/[id]/route.ts`
- Test: `tests/services/locations.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError`
- Produces:
  - `common.ts`: `trimmed` (непорожній рядок), `optionalText` (порожнє → undefined)
  - `location.ts`: `locationCreateSchema`, `locationUpdateSchema`
  - `locations.ts`: `listLocations()`, `getLocation(id)`, `createLocation(data)`, `updateLocation(id, data)`, `deleteLocation(id)` — усі повертають/приймають DTO
  - `interface LocationDTO { id; name; address; notes: string | null }`

- [ ] **Step 1: Написати падаючі тести**

`tests/services/locations.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createLocation, deleteLocation, getLocation, listLocations, updateLocation } from '@/server/services/locations'
import { ApiError } from '@/server/http'
import { prisma } from '@/server/db'

const created: string[] = []
afterEach(async () => {
  await prisma.premises.deleteMany({ where: { locationId: { in: created } } })
  await prisma.location.deleteMany({ where: { id: { in: created } } })
  created.length = 0
})
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('locations service', () => {
  it('створює й читає локацію', async () => {
    const loc = track(await createLocation({ name: 'БЦ Тест', address: 'вул. Тестова, 1' }))
    expect(loc.name).toBe('БЦ Тест')
    expect((await getLocation(loc.id)).address).toBe('вул. Тестова, 1')
  })

  it('список містить створену локацію', async () => {
    const loc = track(await createLocation({ name: 'БЦ У списку', address: 'вул. Друга, 2' }))
    expect((await listLocations()).some((l) => l.id === loc.id)).toBe(true)
  })

  it('оновлює назву', async () => {
    const loc = track(await createLocation({ name: 'Стара', address: 'вул. Третя, 3' }))
    expect((await updateLocation(loc.id, { name: 'Нова' })).name).toBe('Нова')
  })

  it('видаляє порожню локацію', async () => {
    const loc = await createLocation({ name: 'На видалення', address: 'вул. Четверта, 4' })
    await deleteLocation(loc.id)
    await expect(getLocation(loc.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('getLocation неіснуючого → NOT_FOUND', async () => {
    await expect(getLocation('немає')).rejects.toBeInstanceOf(ApiError)
  })

  it('не видаляє локацію з приміщеннями → CONFLICT', async () => {
    const loc = track(await createLocation({ name: 'З приміщенням', address: 'вул. Пʼята, 5' }))
    await prisma.premises.create({ data: { locationId: loc.id, unitNumber: '1', type: 'офіс', areaM2: '10' } })
    await expect(deleteLocation(loc.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/locations.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/locations'`

- [ ] **Step 3: Реалізувати**

`src/lib/validation/common.ts`:
```ts
import { z } from 'zod'

/** Непорожній рядок після трімінгу. */
export const trimmed = z.string().trim().min(1, 'Поле обовʼязкове')

/**
 * Необовʼязковий текст.
 * - відсутнє поле → undefined (Prisma лишає значення без змін при update);
 * - порожній рядок → null (явне «очистити» — записує null у БД);
 * - інакше → трімнутий рядок.
 */
export const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === '' ? null : s))
  .optional()
```

`src/lib/validation/location.ts`:
```ts
import { z } from 'zod'
import { optionalText, trimmed } from './common'

export const locationCreateSchema = z.object({
  name: trimmed,
  address: trimmed,
  notes: optionalText,
})

export const locationUpdateSchema = locationCreateSchema.partial()

export type LocationCreate = z.infer<typeof locationCreateSchema>
export type LocationUpdate = z.infer<typeof locationUpdateSchema>
```

`src/server/services/locations.ts`:
```ts
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import type { LocationCreate, LocationUpdate } from '@/lib/validation/location'

export interface LocationDTO {
  id: string
  name: string
  address: string
  notes: string | null
}

function toDTO(l: { id: string; name: string; address: string; notes: string | null }): LocationDTO {
  return { id: l.id, name: l.name, address: l.address, notes: l.notes }
}

const notFound = () => new ApiError('NOT_FOUND', 'Локацію не знайдено')

export async function listLocations(): Promise<LocationDTO[]> {
  const rows = await prisma.location.findMany({ orderBy: { name: 'asc' } })
  return rows.map(toDTO)
}

export async function getLocation(id: string): Promise<LocationDTO> {
  const l = await prisma.location.findUnique({ where: { id } })
  if (!l) throw notFound()
  return toDTO(l)
}

export async function createLocation(data: LocationCreate): Promise<LocationDTO> {
  return toDTO(await prisma.location.create({ data: { name: data.name, address: data.address, notes: data.notes } }))
}

export async function updateLocation(id: string, data: LocationUpdate): Promise<LocationDTO> {
  await getLocation(id) // 404, якщо немає
  return toDTO(await prisma.location.update({ where: { id }, data }))
}

export async function deleteLocation(id: string): Promise<void> {
  await getLocation(id)
  try {
    await prisma.location.delete({ where: { id } })
  } catch (e) {
    // onDelete: Restrict → приміщення тримають локацію
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiError('CONFLICT', 'Локацію не можна видалити: у ній є приміщення')
    }
    throw e
  }
}
```

> Точний шлях імпорту `Prisma`/`PrismaClientKnownRequestError` підтвердь емпірично
> (`@/generated/prisma/client` реекспортує `Prisma`); якщо код помилки FK у SQLite
> не `P2003`, візьми той, що реально кидає Prisma (перевір у тесті RED).

`src/app/api/locations/route.ts`:
```ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createLocation, listLocations } from '@/server/services/locations'
import { locationCreateSchema } from '@/lib/validation/location'

export const GET = route(async () => {
  await requireUser()
  return json(await listLocations())
})

export const POST = route(async (req) => {
  await requireUser()
  return json(await createLocation(await parseBody(req, locationCreateSchema)), 201)
})
```

`src/app/api/locations/[id]/route.ts`:
```ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deleteLocation, getLocation, updateLocation } from '@/server/services/locations'
import { locationUpdateSchema } from '@/lib/validation/location'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getLocation((await params).id))
})

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updateLocation((await params).id, await parseBody(req, locationUpdateSchema)))
})

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deleteLocation((await params).id)
  return json({ ok: true })
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/locations.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/validation/common.ts src/lib/validation/location.ts \
  src/server/services/locations.ts src/app/api/locations tests/services/locations.test.ts
git commit -m "feat(api): CRUD локацій + валідація-інфраструктура

Service повертає DTO (нема витоку полів БД). Видалення локації з
приміщеннями ловить FK-помилку Prisma і віддає CONFLICT, а не 500."
```

---

### Task 5: Приміщення (CRUD) з похідним статусом «здано/вільне»

**Files:**
- Create: `src/lib/validation/premises.ts`, `src/server/services/premises.ts`
- Create: `src/app/api/premises/route.ts`, `src/app/api/premises/[id]/route.ts`
- Test: `tests/services/premises.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError`, `isPremisesOccupied` з `@/domain/status`
- Produces: `listPremises()`, `getPremises(id)`, `createPremises(data)`, `updatePremises(id, data)`, `deletePremises(id)`;
  `interface PremisesDTO { id; locationId; unitNumber; type; floor: number | null; areaM2: string; notes: string | null; occupied: boolean }`

- [ ] **Step 1: Написати падаючі тести**

`tests/services/premises.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createPremises, deletePremises, getPremises, listPremises, updatePremises } from '@/server/services/premises'
import { prisma } from '@/server/db'

let locationId = ''
const created: string[] = []

afterEach(async () => {
  await prisma.lease.deleteMany({ where: { premisesId: { in: created } } })
  await prisma.premises.deleteMany({ where: { id: { in: created } } })
  created.length = 0
  if (locationId) { await prisma.location.deleteMany({ where: { id: locationId } }); locationId = '' }
})

async function loc() {
  const l = await prisma.location.create({ data: { name: 'Локація П', address: 'вул. П, 1' } })
  locationId = l.id
  return l.id
}
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('premises service', () => {
  it('створює приміщення; площа віддається рядком', async () => {
    const p = track(await createPremises({ locationId: await loc(), unitNumber: '204', type: 'офіс', floor: 2, areaM2: '54.30' }))
    expect(p.areaM2).toBe('54.3')
    expect(typeof p.areaM2).toBe('string')
    expect(p.occupied).toBe(false)
  })

  it('приміщення з активним договором позначається occupied', async () => {
    const locId = await loc()
    const p = track(await createPremises({ locationId: locId, unitNumber: '1', type: 'офіс', areaM2: '20' }))
    const t = await prisma.tenant.create({ data: { name: 'Орендар П' } })
    await prisma.lease.create({ data: { premisesId: p.id, tenantId: t.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: 100000, garbageKop: 0 } })
    try {
      expect((await getPremises(p.id)).occupied).toBe(true)
    } finally {
      await prisma.tenant.deleteMany({ where: { id: t.id } })
    }
  })

  it('оновлює тип', async () => {
    const p = track(await createPremises({ locationId: await loc(), unitNumber: '2', type: 'офіс', areaM2: '30' }))
    expect((await updatePremises(p.id, { type: 'склад' })).type).toBe('склад')
  })

  it('видаляє приміщення без договорів', async () => {
    const p = await createPremises({ locationId: await loc(), unitNumber: '3', type: 'офіс', areaM2: '40' })
    await deletePremises(p.id)
    await expect(getPremises(p.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('дублікат unitNumber у тій самій локації → CONFLICT', async () => {
    const locId = await loc()
    track(await createPremises({ locationId: locId, unitNumber: 'X', type: 'офіс', areaM2: '10' }))
    await expect(createPremises({ locationId: locId, unitNumber: 'X', type: 'склад', areaM2: '20' }))
      .rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/premises.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/premises'`

- [ ] **Step 3: Реалізувати**

`src/lib/validation/premises.ts`:
```ts
import { z } from 'zod'
import { optionalText, trimmed } from './common'

export const premisesCreateSchema = z.object({
  locationId: trimmed,
  unitNumber: trimmed,
  type: trimmed,
  floor: z.number().int().nullable().optional(),
  areaM2: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Площа — число з до двох знаків'),
  notes: optionalText,
})

export const premisesUpdateSchema = premisesCreateSchema.partial()

export type PremisesCreate = z.infer<typeof premisesCreateSchema>
export type PremisesUpdate = z.infer<typeof premisesUpdateSchema>
```

`src/server/services/premises.ts`:
```ts
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { isPremisesOccupied } from '@/domain/status'
import type { PremisesCreate, PremisesUpdate } from '@/lib/validation/premises'

export interface PremisesDTO {
  id: string
  locationId: string
  unitNumber: string
  type: string
  floor: number | null
  areaM2: string
  notes: string | null
  occupied: boolean
}

const notFound = () => new ApiError('NOT_FOUND', 'Приміщення не знайдено')

type Row = Prisma.PremisesModel & { leases: { startDate: Date; endDate: Date | null }[] }

function toDTO(p: Row, today: Date): PremisesDTO {
  return {
    id: p.id,
    locationId: p.locationId,
    unitNumber: p.unitNumber,
    type: p.type,
    floor: p.floor,
    areaM2: p.areaM2.toString(),
    notes: p.notes,
    occupied: isPremisesOccupied(p.leases, today),
  }
}

export async function listPremises(): Promise<PremisesDTO[]> {
  const today = new Date()
  const rows = await prisma.premises.findMany({
    include: { leases: { select: { startDate: true, endDate: true } } },
    orderBy: [{ locationId: 'asc' }, { unitNumber: 'asc' }],
  })
  return rows.map((r) => toDTO(r, today))
}

export async function getPremises(id: string): Promise<PremisesDTO> {
  const p = await prisma.premises.findUnique({
    where: { id },
    include: { leases: { select: { startDate: true, endDate: true } } },
  })
  if (!p) throw notFound()
  return toDTO(p, new Date())
}

export async function createPremises(data: PremisesCreate): Promise<PremisesDTO> {
  try {
    const p = await prisma.premises.create({
      data: {
        locationId: data.locationId,
        unitNumber: data.unitNumber,
        type: data.type,
        floor: data.floor ?? null,
        areaM2: data.areaM2,
        notes: data.notes,
      },
      include: { leases: { select: { startDate: true, endDate: true } } },
    })
    return toDTO(p, new Date())
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiError('CONFLICT', 'Приміщення з таким номером у цій локації вже існує')
    }
    throw e
  }
}

export async function updatePremises(id: string, data: PremisesUpdate): Promise<PremisesDTO> {
  await getPremises(id)
  const p = await prisma.premises.update({
    where: { id },
    data,
    include: { leases: { select: { startDate: true, endDate: true } } },
  })
  return toDTO(p, new Date())
}

export async function deletePremises(id: string): Promise<void> {
  await getPremises(id)
  try {
    await prisma.premises.delete({ where: { id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiError('CONFLICT', 'Приміщення не можна видалити: є повʼязані договори')
    }
    throw e
  }
}
```

`src/app/api/premises/route.ts` і `[id]/route.ts` — за зразком Task 4 (locations),
але зі схемами `premisesCreateSchema`/`premisesUpdateSchema` і service `premises`:
```ts
// src/app/api/premises/route.ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createPremises, listPremises } from '@/server/services/premises'
import { premisesCreateSchema } from '@/lib/validation/premises'

export const GET = route(async () => {
  await requireUser()
  return json(await listPremises())
})

export const POST = route(async (req) => {
  await requireUser()
  return json(await createPremises(await parseBody(req, premisesCreateSchema)), 201)
})
```
```ts
// src/app/api/premises/[id]/route.ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deletePremises, getPremises, updatePremises } from '@/server/services/premises'
import { premisesUpdateSchema } from '@/lib/validation/premises'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getPremises((await params).id))
})

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updatePremises((await params).id, await parseBody(req, premisesUpdateSchema)))
})

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deletePremises((await params).id)
  return json({ ok: true })
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/premises.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/validation/premises.ts src/server/services/premises.ts \
  src/app/api/premises tests/services/premises.test.ts
git commit -m "feat(api): CRUD приміщень із похідним статусом occupied

occupied обчислюється доменним isPremisesOccupied із договорів, не
зберігається. Площа (Decimal) віддається рядком, щоб не серіалізувалась
у {s,e,d}. Дублікат unitNumber у локації → CONFLICT."
```

---

### Task 6: Орендарі (CRUD)

**Files:**
- Create: `src/lib/validation/tenant.ts`, `src/server/services/tenants.ts`
- Create: `src/app/api/tenants/route.ts`, `src/app/api/tenants/[id]/route.ts`
- Test: `tests/services/tenants.test.ts`

**Interfaces:**
- Produces: `listTenants()`, `getTenant(id)`, `createTenant(data)`, `updateTenant(id, data)`, `deleteTenant(id)`;
  `interface TenantDTO { id; name; phone: string | null; email: string | null; taxCode: string | null; notes: string | null }`

- [ ] **Step 1: Написати падаючі тести**

`tests/services/tenants.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createTenant, deleteTenant, getTenant, listTenants, updateTenant } from '@/server/services/tenants'
import { prisma } from '@/server/db'

const created: string[] = []
afterEach(async () => {
  await prisma.lease.deleteMany({ where: { tenantId: { in: created } } })
  await prisma.tenant.deleteMany({ where: { id: { in: created } } })
  created.length = 0
})
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('tenants service', () => {
  it('створює орендаря з необовʼязковими полями', async () => {
    const t = track(await createTenant({ name: 'ТОВ Тест', phone: '+380671112233', taxCode: '12345678' }))
    expect(t.name).toBe('ТОВ Тест')
    expect(t.email).toBeNull()
  })

  it('список містить створеного орендаря', async () => {
    const t = track(await createTenant({ name: 'ФОП У списку' }))
    expect((await listTenants()).some((x) => x.id === t.id)).toBe(true)
  })

  it('оновлює телефон', async () => {
    const t = track(await createTenant({ name: 'ФОП Телефон' }))
    expect((await updateTenant(t.id, { phone: '+380509998877' })).phone).toBe('+380509998877')
  })

  it('видаляє орендаря без договорів', async () => {
    const t = await createTenant({ name: 'На видалення' })
    await deleteTenant(t.id)
    await expect(getTenant(t.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('не видаляє орендаря з договорами → CONFLICT', async () => {
    const t = track(await createTenant({ name: 'З договором' }))
    const loc = await prisma.location.create({ data: { name: 'Л', address: 'вул. Л, 1' } })
    const p = await prisma.premises.create({ data: { locationId: loc.id, unitNumber: '1', type: 'офіс', areaM2: '10' } })
    await prisma.lease.create({ data: { premisesId: p.id, tenantId: t.id, startDate: new Date(Date.UTC(2026, 0, 1)), endDate: null, rentKop: 1, garbageKop: 0 } })
    try {
      await expect(deleteTenant(t.id)).rejects.toMatchObject({ code: 'CONFLICT' })
    } finally {
      await prisma.lease.deleteMany({ where: { tenantId: t.id } })
      await prisma.premises.deleteMany({ where: { id: p.id } })
      await prisma.location.deleteMany({ where: { id: loc.id } })
    }
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/tenants.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/tenants'`

- [ ] **Step 3: Реалізувати**

`src/lib/validation/tenant.ts`:
```ts
import { z } from 'zod'
import { optionalText, trimmed } from './common'

export const tenantCreateSchema = z.object({
  name: trimmed,
  phone: optionalText,
  email: optionalText,
  taxCode: optionalText,
  notes: optionalText,
})

export const tenantUpdateSchema = tenantCreateSchema.partial()

export type TenantCreate = z.infer<typeof tenantCreateSchema>
export type TenantUpdate = z.infer<typeof tenantUpdateSchema>
```

`src/server/services/tenants.ts`:
```ts
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import type { TenantCreate, TenantUpdate } from '@/lib/validation/tenant'

export interface TenantDTO {
  id: string
  name: string
  phone: string | null
  email: string | null
  taxCode: string | null
  notes: string | null
}

function toDTO(t: Prisma.TenantModel): TenantDTO {
  return { id: t.id, name: t.name, phone: t.phone, email: t.email, taxCode: t.taxCode, notes: t.notes }
}

const notFound = () => new ApiError('NOT_FOUND', 'Орендаря не знайдено')

export async function listTenants(): Promise<TenantDTO[]> {
  return (await prisma.tenant.findMany({ orderBy: { name: 'asc' } })).map(toDTO)
}

export async function getTenant(id: string): Promise<TenantDTO> {
  const t = await prisma.tenant.findUnique({ where: { id } })
  if (!t) throw notFound()
  return toDTO(t)
}

export async function createTenant(data: TenantCreate): Promise<TenantDTO> {
  return toDTO(await prisma.tenant.create({ data }))
}

export async function updateTenant(id: string, data: TenantUpdate): Promise<TenantDTO> {
  await getTenant(id)
  return toDTO(await prisma.tenant.update({ where: { id }, data }))
}

export async function deleteTenant(id: string): Promise<void> {
  await getTenant(id)
  try {
    await prisma.tenant.delete({ where: { id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiError('CONFLICT', 'Орендаря не можна видалити: є повʼязані договори')
    }
    throw e
  }
}
```

Route-handler'и `src/app/api/tenants/route.ts` і `[id]/route.ts` — за зразком Task 4,
зі схемами `tenantCreateSchema`/`tenantUpdateSchema` і service `tenants`:
```ts
// src/app/api/tenants/route.ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createTenant, listTenants } from '@/server/services/tenants'
import { tenantCreateSchema } from '@/lib/validation/tenant'

export const GET = route(async () => {
  await requireUser()
  return json(await listTenants())
})
export const POST = route(async (req) => {
  await requireUser()
  return json(await createTenant(await parseBody(req, tenantCreateSchema)), 201)
})
```
```ts
// src/app/api/tenants/[id]/route.ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deleteTenant, getTenant, updateTenant } from '@/server/services/tenants'
import { tenantUpdateSchema } from '@/lib/validation/tenant'

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await getTenant((await params).id))
})
export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  return json(await updateTenant((await params).id, await parseBody(req, tenantUpdateSchema)))
})
export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deleteTenant((await params).id)
  return json({ ok: true })
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/tenants.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/validation/tenant.ts src/server/services/tenants.ts \
  src/app/api/tenants tests/services/tenants.test.ts
git commit -m "feat(api): CRUD орендарів"
```

---

### Task 7: Тарифи (CRUD)

**Files:**
- Create: `src/lib/validation/tariff.ts`, `src/server/services/tariffs.ts`
- Create: `src/app/api/tariffs/route.ts`, `src/app/api/tariffs/[id]/route.ts`
- Test: `tests/services/tariffs.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError`, `toKop` з `@/domain/money`
- Produces: `listTariffs()`, `createTariff(data)`, `deleteTariff(id)`;
  `interface TariffDTO { id; effectiveFrom: string; electricityRateKop: number; waterRateKop: number }`
  (тарифи не редагуються — історія незмінна; лише додати/видалити)

- [ ] **Step 1: Написати падаючі тести**

`tests/services/tariffs.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createTariff, deleteTariff, listTariffs } from '@/server/services/tariffs'
import { prisma } from '@/server/db'

const created: string[] = []
afterEach(async () => {
  await prisma.tariff.deleteMany({ where: { id: { in: created } } })
  created.length = 0
})
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('tariffs service', () => {
  it('створює тариф; ставки конвертуються в копійки', async () => {
    const t = track(await createTariff({ effectiveFrom: '2027-01-01', electricityUah: '4.32', waterUah: '12.50' }))
    expect(t.electricityRateKop).toBe(432)
    expect(t.waterRateKop).toBe(1250)
    expect(t.effectiveFrom).toContain('2027-01-01')
  })

  it('список відсортований за датою', async () => {
    track(await createTariff({ effectiveFrom: '2027-03-01', electricityUah: '5', waterUah: '13' }))
    track(await createTariff({ effectiveFrom: '2027-02-01', electricityUah: '4.8', waterUah: '13' }))
    const list = (await listTariffs()).filter((t) => t.effectiveFrom.startsWith('2027'))
    const dates = list.map((t) => t.effectiveFrom)
    expect([...dates]).toEqual([...dates].sort())
  })

  it('дублікат дати дії → CONFLICT', async () => {
    track(await createTariff({ effectiveFrom: '2027-06-01', electricityUah: '5', waterUah: '14' }))
    await expect(createTariff({ effectiveFrom: '2027-06-01', electricityUah: '6', waterUah: '15' }))
      .rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('некоректна сума ставки → VALIDATION_FAILED', async () => {
    await expect(createTariff({ effectiveFrom: '2027-07-01', electricityUah: '4.999', waterUah: '1' }))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('видаляє тариф', async () => {
    const t = await createTariff({ effectiveFrom: '2027-08-01', electricityUah: '5', waterUah: '14' })
    await deleteTariff(t.id)
    expect((await listTariffs()).some((x) => x.id === t.id)).toBe(false)
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/tariffs.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/tariffs'`

- [ ] **Step 3: Реалізувати**

`src/lib/validation/tariff.ts`:
```ts
import { z } from 'zod'

export const tariffCreateSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата у форматі YYYY-MM-DD'),
  electricityUah: z.string().trim().min(1),
  waterUah: z.string().trim().min(1),
})

export type TariffCreate = z.infer<typeof tariffCreateSchema>
```

`src/server/services/tariffs.ts`:
```ts
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { toKop } from '@/domain/money'
import { InvalidAmountError } from '@/domain/errors'
import type { TariffCreate } from '@/lib/validation/tariff'

export interface TariffDTO {
  id: string
  effectiveFrom: string
  electricityRateKop: number
  waterRateKop: number
}

function toDTO(t: Prisma.TariffModel): TariffDTO {
  return {
    id: t.id,
    effectiveFrom: t.effectiveFrom.toISOString(),
    electricityRateKop: t.electricityRateKop,
    waterRateKop: t.waterRateKop,
  }
}

export async function listTariffs(): Promise<TariffDTO[]> {
  return (await prisma.tariff.findMany({ orderBy: { effectiveFrom: 'asc' } })).map(toDTO)
}

export async function createTariff(data: TariffCreate): Promise<TariffDTO> {
  // Конвертація грн→копійки на межі сервісу; помилку toKop мапимо у VALIDATION_FAILED.
  let electricityRateKop: number
  let waterRateKop: number
  try {
    electricityRateKop = toKop(data.electricityUah)
    waterRateKop = toKop(data.waterUah)
  } catch (e) {
    if (e instanceof InvalidAmountError) {
      throw new ApiError('VALIDATION_FAILED', 'Некоректна ставка тарифу', { rate: e.message })
    }
    throw e
  }
  try {
    const t = await prisma.tariff.create({
      data: { effectiveFrom: new Date(`${data.effectiveFrom}T00:00:00.000Z`), electricityRateKop, waterRateKop },
    })
    return toDTO(t)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiError('CONFLICT', 'Тариф на цю дату вже існує')
    }
    throw e
  }
}

export async function deleteTariff(id: string): Promise<void> {
  const t = await prisma.tariff.findUnique({ where: { id } })
  if (!t) throw new ApiError('NOT_FOUND', 'Тариф не знайдено')
  await prisma.tariff.delete({ where: { id } })
}
```

Route-handler'и `src/app/api/tariffs/route.ts` (GET list, POST create) і
`[id]/route.ts` (DELETE) — за зразком Task 4, service `tariffs`, схема
`tariffCreateSchema`. (PATCH немає — тарифи не редагуються.)
```ts
// src/app/api/tariffs/route.ts
import { requireUser } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createTariff, listTariffs } from '@/server/services/tariffs'
import { tariffCreateSchema } from '@/lib/validation/tariff'

export const GET = route(async () => {
  await requireUser()
  return json(await listTariffs())
})
export const POST = route(async (req) => {
  await requireUser()
  return json(await createTariff(await parseBody(req, tariffCreateSchema)), 201)
})
```
```ts
// src/app/api/tariffs/[id]/route.ts
import { requireUser } from '@/server/auth/guard'
import { json, route } from '@/server/http'
import { deleteTariff } from '@/server/services/tariffs'

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  await deleteTariff((await params).id)
  return json({ ok: true })
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/tariffs.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/validation/tariff.ts src/server/services/tariffs.ts \
  src/app/api/tariffs tests/services/tariffs.test.ts
git commit -m "feat(api): тарифи (додати/видалити, без редагування)

Ставки вводяться в грн і конвертуються в копійки через доменний toKop;
помилка суми → VALIDATION_FAILED. Тарифи не редагуються — історія
незмінна, старі нарахування спираються на заморожені ставки."
```

---

### Task 8: Користувачі (CRUD, лише ADMIN)

**Files:**
- Create: `src/lib/validation/user.ts`, `src/server/services/users.ts`
- Create: `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`
- Test: `tests/services/users.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError`, `hashPassword`
- Produces: `listUsers()`, `createUser(data)`, `updateUser(id, data)`, `deleteUser(id, currentUserId)`;
  `interface UserDTO { id; email; name; role: 'ADMIN' | 'USER'; isActive: boolean }` — **без passwordHash**

- [ ] **Step 1: Написати падаючі тести**

`tests/services/users.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createUser, deleteUser, listUsers, updateUser } from '@/server/services/users'
import { prisma } from '@/server/db'

const created: string[] = []
afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created } } })
  created.length = 0
})
const track = <T extends { id: string }>(x: T) => { created.push(x.id); return x }

describe('users service', () => {
  it('створює користувача; DTO не містить passwordHash', async () => {
    const u = track(await createUser({ email: 'new-user@example.com', name: 'Новий', role: 'USER', password: 'parol12345' }))
    expect(u).not.toHaveProperty('passwordHash')
    expect(u.role).toBe('USER')
    expect(u.isActive).toBe(true)
  })

  it('дублікат email → CONFLICT', async () => {
    track(await createUser({ email: 'dup@example.com', name: 'А', role: 'USER', password: 'parol12345' }))
    await expect(createUser({ email: 'dup@example.com', name: 'Б', role: 'ADMIN', password: 'parol12345' }))
      .rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('деактивує користувача', async () => {
    const u = track(await createUser({ email: 'deact@example.com', name: 'Деакт', role: 'USER', password: 'parol12345' }))
    expect((await updateUser(u.id, { isActive: false })).isActive).toBe(false)
  })

  it('оновлення пароля не ламає вхід (хеш змінюється)', async () => {
    const u = track(await createUser({ email: 'pw@example.com', name: 'Пароль', role: 'USER', password: 'staryi12345' }))
    await updateUser(u.id, { password: 'novyi123456' })
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(row.passwordHash).not.toBe('novyi123456')
  })

  it('адмін не може видалити сам себе → CONFLICT', async () => {
    const u = track(await createUser({ email: 'self@example.com', name: 'Я', role: 'ADMIN', password: 'parol12345' }))
    await expect(deleteUser(u.id, u.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('видаляє іншого користувача', async () => {
    const u = await createUser({ email: 'other@example.com', name: 'Інший', role: 'USER', password: 'parol12345' })
    await deleteUser(u.id, 'admin-хтось-інший')
    expect((await listUsers()).some((x) => x.id === u.id)).toBe(false)
  })
})
```

- [ ] **Step 2: Запустити — переконатися, що падає**

Run: `npm test -- tests/services/users.test.ts`
Expected: FAIL — `Cannot find module '@/server/services/users'`

- [ ] **Step 3: Реалізувати**

`src/lib/validation/user.ts`:
```ts
import { z } from 'zod'
import { trimmed } from './common'

export const userCreateSchema = z.object({
  email: z.email('Некоректний email'), // Zod 4: top-level, не z.string().email()
  name: trimmed,
  role: z.enum(['ADMIN', 'USER']),
  password: z.string().min(8, 'Пароль щонайменше 8 символів'),
})

export const userUpdateSchema = z.object({
  name: trimmed.optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'Пароль щонайменше 8 символів').optional(),
})

export type UserCreate = z.infer<typeof userCreateSchema>
export type UserUpdate = z.infer<typeof userUpdateSchema>
```

`src/server/services/users.ts`:
```ts
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { hashPassword } from '@/server/auth/password'
import type { UserCreate, UserUpdate } from '@/lib/validation/user'

export interface UserDTO {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'USER'
  isActive: boolean
}

function toDTO(u: Prisma.UserModel): UserDTO {
  return { id: u.id, email: u.email, name: u.name, role: u.role === 'ADMIN' ? 'ADMIN' : 'USER', isActive: u.isActive }
}

export async function listUsers(): Promise<UserDTO[]> {
  return (await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })).map(toDTO)
}

export async function createUser(data: UserCreate): Promise<UserDTO> {
  try {
    const u = await prisma.user.create({
      data: { email: data.email, name: data.name, role: data.role, passwordHash: await hashPassword(data.password) },
    })
    return toDTO(u)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiError('CONFLICT', 'Користувач із таким email уже існує')
    }
    throw e
  }
}

export async function updateUser(id: string, data: UserUpdate): Promise<UserDTO> {
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw new ApiError('NOT_FOUND', 'Користувача не знайдено')

  const patch: Prisma.UserUpdateInput = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.role !== undefined) patch.role = data.role
  if (data.isActive !== undefined) patch.isActive = data.isActive
  if (data.password !== undefined) patch.passwordHash = await hashPassword(data.password)

  return toDTO(await prisma.user.update({ where: { id }, data: patch }))
}

export async function deleteUser(id: string, currentUserId: string): Promise<void> {
  if (id === currentUserId) {
    throw new ApiError('CONFLICT', 'Не можна видалити власний обліковий запис')
  }
  const u = await prisma.user.findUnique({ where: { id } })
  if (!u) throw new ApiError('NOT_FOUND', 'Користувача не знайдено')
  await prisma.user.delete({ where: { id } })
}
```

Route-handler'и — з `requireAdmin` (не `requireUser`), і DELETE передає id
поточного адміна в service:
```ts
// src/app/api/users/route.ts
import { requireAdmin } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { createUser, listUsers } from '@/server/services/users'
import { userCreateSchema } from '@/lib/validation/user'

export const GET = route(async () => {
  await requireAdmin()
  return json(await listUsers())
})
export const POST = route(async (req) => {
  await requireAdmin()
  return json(await createUser(await parseBody(req, userCreateSchema)), 201)
})
```
```ts
// src/app/api/users/[id]/route.ts
import { requireAdmin } from '@/server/auth/guard'
import { json, parseBody, route } from '@/server/http'
import { deleteUser, updateUser } from '@/server/services/users'
import { userUpdateSchema } from '@/lib/validation/user'

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  return json(await updateUser((await params).id, await parseBody(req, userUpdateSchema)))
})
export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  await deleteUser((await params).id, admin.id)
  return json({ ok: true })
})
```

- [ ] **Step 4: Запустити — переконатися, що проходить**

Run: `npm test -- tests/services/users.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/validation/user.ts src/server/services/users.ts \
  src/app/api/users tests/services/users.test.ts
git commit -m "feat(api): CRUD користувачів (лише ADMIN)

DTO ніколи не містить passwordHash. Пароль хешується при створенні й
зміні. Адмін не може видалити сам себе (щоб не лишити систему без адміна)."
```

---

### Task 9: Наскрізна перевірка — типізація і збірка всього API

**Files:** без нових; перевірка й, за потреби, дрібні виправлення.

- [ ] **Step 1: Повна типізація**

Run: `npx tsc --noEmit`
Expected: exit 0. Якщо десь протікає `Prisma.XModel` чи шлях імпорту — виправ у
відповідному service.

- [ ] **Step 2: Повний набір тестів**

Run: `npm test`
Expected: усі файли зелені (доменні з Плану 1 + нові service/http/auth-тести),
вивід чистий.

- [ ] **Step 3: Збірка з усіма маршрутами**

Run: `npm run build`
Expected: успішно; у списку маршрутів усі `/api/*`: auth (login/logout/me),
locations, premises, tenants, tariffs, users (кожен + `[id]`).

- [ ] **Step 4: Коміт (якщо були виправлення)**

```bash
git add -A
git commit -m "chore(api): наскрізна перевірка — tsc, тести, збірка зелені"
```

---

## Підсумок плану

Після Task 9 маємо працюючий бекенд авторизації й довідкових даних:
- сесія (jose) + пароль (bcryptjs) + guard (`requireUser`/`requireAdmin`);
- CRUD API для локацій, приміщень, орендарів, тарифів, користувачів;
- єдиний envelope помилок за §6.1; DTO без витоку полів БД; гроші в копійках,
  Decimal у рядках.

Наступний план (**2b: транзакційний API**) додає договори (з `hasOverlap`),
показники (масовий upsert, `READING_DECREASED`, `findPreviousReading`), формування
нарахувань (`buildInvoice`, `pickTariffForMonth`, `isLeaseActiveInMonth`, причини
пропуску), оплати, статуси рахунків (`allocatePayments`), борги і звіти (CSV).
Він споживає guard і envelope, зроблені тут.

---

## Пост-рев'ю фікси (фінальний огляд гілки)

Два Important, виправлені після реалізації (див. коміт `fix(api): updatePremises
P2002->CONFLICT і self-lockout guard`):
1. **`updatePremises`** тепер ловить `P2002` і мапить у `CONFLICT` (як `createPremises`):
   PATCH `unitNumber`/`locationId` може зіткнутися з `@@unique([locationId, unitNumber])`.
2. **`updateUser(id, data, currentUserId)`** отримав self-lockout guard (симетрично
   `deleteUser`): адмін не може деактивувати чи понизити САМ СЕБЕ. Роут передає `admin.id`.

Відкладено до Плану 2b: CSRF-токен (там зʼявляться грошові мутації — оплати/нарахування).
