# Облік комерційної оренди — дизайн-документ

**Дата:** 2026-07-10
**Статус:** затверджено до реалізації
**Репозиторій:** https://github.com/AndriyYaremenko/rental-service

## 1. Мета й межі

Вебзастосунок для орендодавця, який веде облік комерційних приміщень, орендарів,
договорів і комунальних послуг (електрика, вода, вивіз сміття). Інтерфейс
українською, валюта — гривня.

### Не входить в обсяг (свідомо)

ПДВ, пеня, індексація орендної плати, пропорційний розрахунок за неповні дні,
мультивалютність, кілька орендодавців в одній базі, мобільний застосунок.
Розрахунки навмисно тримаються максимально простими.

## 2. Стек

| Шар | Рішення |
|---|---|
| Фреймворк | Next.js (App Router) + TypeScript |
| БД | SQLite + Prisma (**≥ 6.2.0**, див. §4.1) |
| Стилі | Tailwind CSS |
| Дані на клієнті | TanStack Query v5 |
| Валідація | Zod (спільні схеми для API і форм) |
| Тести | Vitest |
| Авторизація | власна сесія: `bcrypt` + JWT (`jose`) у httpOnly-cookie |

## 3. Ключові рішення та їх обґрунтування

Кожне з цих рішень закриває розбіжність між початковим промтом і реальністю
(дизайном або коректністю розрахунків).

### 3.1 Локації як окрема сутність

Дизайн у Stitch показує дворівневу структуру: будівлі («Equinox Plaza East»),
всередині — таблиця приміщень з колонками `Unit # / Type / Floor / Area / Status`.
Початкова схема мала лише плоскі `Premises` з текстовою адресою.

**Рішення:** вводимо `Location`, приміщення належить локації. Групування за
текстовим полем адреси було б крихким — одрук створює «нову локацію».

### 3.2 Показники лічильників належать приміщенню, не договору

Лічильник фізично стоїть у приміщенні. Якби показники висіли на договорі, то при
зміні орендаря новий договір не мав би попереднього показника, і споживання
порахувалося б як `поточний − 0`, тобто рахунок за весь час життя лічильника.

**Рішення:** `MeterReading` посилається на `Premises`. Історія лічильника
безперервна й переживає зміну орендарів. Нарахування знаходить активний договір
приміщення на потрібний місяць.

### 3.3 Статус рахунку — обчислюваний, не збережений

`Payment` належить договору (як у промті), а не конкретному рахунку. Тому
зберігати `Invoice.status` у базі означало б тримати другу версію правди, яка
рано чи пізно розійдеться з фактичними оплатами.

**Рішення:** статус виводиться FIFO-рознесенням оплат по рахунках від
найстарішого. Це узгоджується з визначенням боргу з промту:
`борг = Σ нарахувань − Σ оплат`.

### 3.4 Тариф — чинний на кінець розрахункового місяця

Показники знімають наприкінці місяця, отже застосовується тариф, що діє на той
момент. Пропорційний поділ місяця між тарифами промт прямо забороняє.

**Рішення:** беремо останній `Tariff` з `effectiveFrom <= останній день місяця`.
Застосовані ставки **копіюються в рахунок**, тому історичні нарахування ніколи
не перераховуються заднім числом.

### 3.5 Гроші — цілі копійки

SQLite не має справжнього `DECIMAL`: колонка отримує NUMERIC-афінність, і `1234.56`
зберігається як 8-байтовий double. У FIFO-рознесенні та звітах такі похибки
накопичуються.

**Рішення:** усі суми — `Int` у копійках, тарифи — `Int` копійок за одиницю.
Показники лічильників лишаються `Decimal` (це фізичні величини, не гроші).
Конвертація грн ↔ копійки відбувається **на межі API**; усередині системи
гуляють тільки цілі числа.

### 3.6 Ролі ADMIN / USER

Промт суперечив сам собі: «застосунок для одного користувача» проти «створи
адміна, який зможе додавати користувачів».

**Рішення:** дві ролі. `ADMIN` керує користувачами, `USER` веде облік і не бачить
сторінки користувачів. Seed створює одного адміна.

### 3.7 Архітектура: REST API + React Query

Обрано свідомо (замість Server Actions), щоб API-шар лишався перевикористовуваним
для можливого зовнішнього клієнта.

### 3.8 Жодного збереженого похідного стану

Той самий аргумент, що й у §3.3, застосовується послідовно до всіх статусів.
Промт називає три: статус рахунку, статус приміщення (вільне / здано) і статус
договору (активний / завершений). **Жоден із них не зберігається** — усі три
виводяться з даних:

| Статус | Виводиться з |
|---|---|
| рахунку | FIFO-рознесення оплат договору (§5.6) |
| приміщення | існує договір, активний на сьогодні |
| договору | `endDate IS NULL OR endDate ≥ сьогодні` → активний, інакше завершений |

Завершити договір = проставити `endDate`. Окремого поля-прапорця немає, тому
розійтися з правдою нічому.

Це не косметика. Якби статус договору зберігався, фільтр `status = ACTIVE` у
відборі договорів для нарахування створив би тихий баг: договір, що діяв
січень–березень і вже завершився, у квітні випав би з формування рахунку **за
лютий**, хоча в лютому був чинним. Тому активність договору в місяці
визначається **виключно датами** (§5.4), а не статусом.

## 4. Модель даних

### 4.1 Застереження щодо enum на SQLite

Enum підтримується SQLite-конектором починаючи з **Prisma 6.2.0**, але
валідується **на рівні ORM, а не бази**. База не відхилить стороннє значення —
впаде Prisma Client при читанні. Версію Prisma фіксуємо в `package.json`.

### 4.2 Схема

```prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "sqlite"; url = env("DATABASE_URL") }

enum Role          { ADMIN USER }
enum PaymentMethod { CASH CARD BANK }   // готівка / картка / рахунок

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
  type       String         // офіс / склад / ритейл
  floor      Int?
  areaM2     Decimal
  notes      String?
  leases     Lease[]
  readings   MeterReading[]
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  @@unique([locationId, unitNumber])
}
// «вільне / здано» не зберігається — виводиться з договорів, див. §3.8

model Tenant {
  id        String   @id @default(cuid())
  name      String
  phone     String?
  email     String?
  taxCode   String?  // ЄДРПОУ / ІПН
  notes     String?
  leases    Lease[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Lease {
  id         String   @id @default(cuid())
  premisesId String
  premises   Premises @relation(fields: [premisesId], references: [id], onDelete: Restrict)
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  startDate  DateTime
  endDate    DateTime?   // null = безстроковий; завершення = проставити дату
  rentKop    Int         // місячна оренда, копійки
  garbageKop Int         // вивіз сміття, копійки/міс
  invoices   Invoice[]
  payments   Payment[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([premisesId, startDate])
  @@index([tenantId])
}
// «активний / завершений» не зберігається — виводиться з endDate, див. §3.8

model Tariff {
  id                 String   @id @default(cuid())
  effectiveFrom      DateTime @unique
  electricityRateKop Int      // копійки за кВт·год
  waterRateKop       Int      // копійки за м³
  createdAt          DateTime @default(now())
}

model MeterReading {
  id          String   @id @default(cuid())
  premisesId  String
  premises    Premises @relation(fields: [premisesId], references: [id], onDelete: Cascade)
  year        Int
  month       Int      // 1..12
  electricity Decimal
  water       Decimal

  // Заміна лічильника — окремо для кожного ресурсу, бо міняють їх незалежно
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

  // Заморожені вхідні дані — рахунок ніколи не «попливе»
  electricityRateKop Int
  waterRateKop       Int

  // prev* — база, від якої рахували споживання. Якщо лічильник замінено,
  // сюди лягає початковий показник нового лічильника, а не показник старого.
  prevElectricity Decimal
  currElectricity Decimal
  electricityUsed Decimal
  prevWater       Decimal
  currWater       Decimal
  waterUsed       Decimal

  // Суми, копійки
  rentKop        Int
  electricityKop Int
  waterKop       Int
  garbageKop     Int
  totalKop       Int

  createdAt DateTime @default(now())

  @@unique([leaseId, year, month])  // «двічі за місяць» неможливо на рівні БД
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

Свідомо відсутні поля `Invoice.status`, `Premises.status`, `Lease.status` —
усі три є похідними, див. §3.3 і §3.8.

## 5. Доменна логіка (`src/domain/`)

Чисті функції без Prisma й без React. Саме тут живуть гроші, тому цей шар
пишеться через TDD і покривається тестами першим.

| Модуль | Відповідальність |
|---|---|
| `money.ts` | грн ↔ копійки, `roundHalfUp`, форматування |
| `consumption.ts` | споживання, зокрема при заміні лічильника |
| `invoice.ts` | побудова рахунку з показників, тарифу й договору |
| `allocation.ts` | FIFO-рознесення оплат → статуси рахунків |
| `debt.ts` | борг і аванс по договору / орендарю |
| `status.ts` | похідні статуси: активність договору, зайнятість приміщення (§3.8) |
| `overlap.ts` | перетин періодів договорів (§6.2) |

### 5.1 Попередній показник

Попередній показник — це **останній наявний запис по цьому приміщенню раніше
розрахункового місяця**, а не «місяць мінус один». Дірки в даних не ламають
розрахунок.

### 5.2 Споживання

```
якщо electricityReplaced:  spent = currElectricity − electricityReplacedInitial
інакше:                    spent = currElectricity − prevElectricity
```
Аналогічно для води. Споживання не може бути відʼємним; відʼємний результат —
помилка валідації, а не відʼємний рахунок.

### 5.3 Округлення — рівно один раз, по кожному рядку

```
electricityKop = roundHalfUp(spentKWh × electricityRateKop)
waterKop       = roundHalfUp(spentM3  × waterRateKop)
rentKop        = lease.rentKop
garbageKop     = lease.garbageKop
totalKop       = rentKop + electricityKop + waterKop + garbageKop
```

Множення виконується на `Decimal.js`
(`.times(rateKop).toDecimalPlaces(0, ROUND_HALF_UP)`), далі — тільки цілі числа.
Оскільки total є сумою вже округлених рядків, дрейфу немає.

### 5.4 Активність договору в місяці M

Визначається **тільки датами** — жодного фільтра за статусом (§3.8):

```
startDate ≤ останній_день(M)
AND (endDate IS NULL OR endDate ≥ перший_день(M))
```

Договір, що вже завершився, лишається чинним для тих місяців, у яких він діяв.
Це дозволяє формувати нарахування за минулі місяці заднім числом.

### 5.5 Формування нарахувань за місяць M

Для кожного активного договору потрібні: показник за M, будь-який показник
раніше M, і чинний тариф. Якщо чогось бракує — договір **пропускається** з
причиною, а не рахується від нуля.

Причини пропуску: `NO_CURRENT_READING`, `NO_PREVIOUS_READING`, `NO_TARIFF`,
`ALREADY_EXISTS`.

### 5.6 FIFO-рознесення

```
пул = Σ оплат договору
для рахунків, впорядкованих за (year, month) зростанням, потім createdAt:
    покрито = min(пул, totalKop)
    пул    −= покрито
    статус  = покрито == 0        → НЕ ОПЛАЧЕНО
              покрито <  totalKop → ЧАСТКОВО
              покрито == totalKop → ОПЛАЧЕНО
залишок пулу = аванс (переплата)
```

Борг = `Σ рахунків − Σ оплат`. Відʼємне значення означає аванс.

## 6. API

REST на Route Handlers, споживається через TanStack Query.

```
POST   /api/auth/login      {email, password} → httpOnly cookie
POST   /api/auth/logout
GET    /api/auth/me

CRUD:  /api/locations · /api/premises · /api/tenants
       /api/leases · /api/tariffs · /api/payments
       /api/users                                   ← requireAdmin

GET    /api/readings?year&month  → приміщення з активним договором,
                                    поточний і попередній показник
POST   /api/readings             → масовий upsert за місяць

POST   /api/invoices/generate    {year, month} → {created[], skipped[{leaseId, reason}]}
GET    /api/invoices?year&month
GET    /api/invoices/[id]        → розбивка + обчислений статус

GET    /api/reports/debts
GET    /api/reports/monthly?year&month
GET    /api/reports/premises/[id]
GET    /api/reports/export?type=… → text/csv
```

Усі маршрути, крім `/api/auth/login`, вимагають сесії (`requireUser`).
`/api/users*` додатково вимагає `requireAdmin`.

### 6.1 Формат помилки

```json
{ "error": { "code": "LEASE_OVERLAP", "message": "…", "fields": { "startDate": "…" } } }
```

| Код | HTTP | Причина | Реакція UI |
|---|---|---|---|
| `READING_DECREASED` | 409 | показник менший за попередній | діалог «лічильник замінено?» → повтор із `electricityReplaced` / `waterReplaced` та початковим показником |
| `INVOICE_EXISTS` | 409 | нарахування за цей місяць уже існує | повідомлення (гарантія від `@@unique`) |
| `LEASE_OVERLAP` | 409 | періоди договорів на приміщенні перетинаються | підсвітка полів дат |
| `VALIDATION_FAILED` | 400 | Zod відхилив тіло запиту | помилки під полями |
| `UNAUTHORIZED` / `FORBIDDEN` | 401 / 403 | немає сесії / бракує ролі | редірект на логін / 403 |

### 6.2 Перетин договорів

Серед **усіх** договорів приміщення (без фільтра за статусом — його немає):
```
newStart ≤ (existEnd ?? +∞)  AND  existStart ≤ (newEnd ?? +∞)
```
Два договори на одне приміщення не можуть перетинатися в часі взагалі — ні
активні, ні завершені. Це строгіше за формулювання промту й простіше в реалізації.

## 7. Інтерфейс

### 7.1 Джерело дизайну

Проєкт Google Stitch `projects/9960273048947424604` — «Облік Комерційної Оренди».
Чотири десктопні макети експортуються в `/design` і комітяться як довідка.

| Макет Stitch | Екран застосунку |
|---|---|
| Executive Dashboard | Дашборд |
| Locations & Premises | Приміщення |
| Utility Readings | Показники |
| Tenants Management | Орендарі |

Макетів **немає** для: Договори, Нарахування, Оплати, Звіти, Налаштування —
робляться з тих самих компонентів у тому ж стилі. Сайдбар розширюється з
чотирьох пунктів до девʼяти.

### 7.2 Порт токенів

Inline `tailwind.config` з CDN-версії макета переноситься у справжній
`tailwind.config.ts` без зміни значень: `primary #041627`,
`primary-container #1a2b3c`, `secondary #006a6a` (teal), `surface #f8f9ff`,
`on-surface #0b1c30`, `error #ba1a1a`. `darkMode: "class"` зберігається.

Шрифти (Inter, Material Symbols Outlined) підключаються **self-hosted** через
`next/font`, без звернень до зовнішніх CDN.

### 7.3 Компоненти

`components/ui/`: `Card` (радіус 12px, розсіяна тінь), `Button`
(navy / ghost / teal), `StatusChip` (pill), `DataTable` (без бордерів,
uppercase-заголовки, hover-підсвітка рядка), `KpiCard`, `Input` (радіус 8px,
teal-свічення у фокусі), `Modal`.

### 7.4 Відхилення від макета

Макет «Utility Readings» — це журнал записів. Промт вимагає форму масового вводу
за місяць. Реалізуємо форму масового вводу (з попереднім показником поруч для
зручності), а журнал лишаємо нижче на тій самій сторінці в стилі макета.

### 7.5 Локалізація

Увесь текст українською; англійські підписи макета («Equinox Management») —
замінюються. Гроші форматуються через `Intl.NumberFormat('uk-UA')` → `1 234,56 грн`.
Площа — у м² (у макеті sq ft).

Друк рахунку — окрема сторінка `/invoices/[id]/print` з правилами `@media print`.

## 8. Валідації

- Zod-схеми в `lib/validation/` спільні для API і форм — правило описане один раз.
- Суми вводяться в грн з двома знаками, `toKop()` конвертує на межі API.
- Показник менший за попередній → `READING_DECREASED`, підтвердження через
  прапорець заміни лічильника (§5.2).
- Повторне нарахування неможливе на рівні БД (`@@unique([leaseId, year, month])`).
- Видалення: підтвердження в UI + `onDelete: Restrict` на звʼязках — приміщення
  з договорами не видаляється.

## 9. Тестування

Основний фокус — `src/domain/` під Vitest, оскільки саме там ціна помилки
найвища:

- споживання, зокрема при заміні лічильника й при дірках у показниках;
- округлення та відсутність дрейфу в `totalKop`;
- побудова рахунку із замороженими ставками;
- FIFO: часткова оплата, переплата, кілька несплачених місяців поспіль;
- борг і аванс;
- перетин періодів договорів;
- похідні статуси, зокрема нарахування за минулий місяць по вже завершеному
  договору (регресія на баг з §3.8).

Доменний шар пишеться через TDD (`superpowers:test-driven-development`).

Наскрізна перевірка (крок 7 промту): seed → договір → показники → нарахування →
оплата → звіт.

## 10. Розгортання

Домен **`rent.ksm.in.ua`** уже вказує на `193.242.161.17` (перевірено DNS).
Сервер: Debian 13 (trixie), kernel 6.12, Docker встановлено. Доступ — `ssh rental-dev`
за ключем `~/.ssh/rental_service`.

Розгортання **не входить у першу ітерацію**. Коли дійде черга: Docker-образ,
reverse proxy з TLS (Let's Encrypt), файл SQLite на постійному томі з бекапом.

## 11. Етапи реалізації

1. Ініціалізація проєкту, Prisma-схема, міграція
2. Seed: 2 локації, 3 приміщення, 2 орендарі, 2 активні договори, тарифи,
   показники за 2 місяці
3. **Доменний шар + тести (TDD)**
4. Авторизація, guard, middleware
5. CRUD API + хуки React Query
6. Показники та формування нарахувань
7. Оплати, борги, звіти, експорт CSV
8. Порт дизайну на всі екрани
9. Наскрізна перевірка ланцюга та версія для друку

Домен і тести передують інтерфейсу: помилки в грошах ловляться до того, як
обростуть UI.
