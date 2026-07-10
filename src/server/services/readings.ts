import { prisma } from '@/server/db'
import { isLeaseActiveInMonth } from '@/domain/status'
import { findPreviousReading } from '@/domain/readings'
import { ApiError } from '@/server/http'
import { Decimal } from 'decimal.js'

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

/** Масовий upsert показників за місяць. Ключ — (premisesId, year, month), повтор оновлює.
 *
 * Атомарно: спершу перевіряємо ВСІ записи (жодного запису в БД), і лише якщо
 * жоден не зменшується — застосовуємо всі upsert-и в одній транзакції. Інакше
 * збій на 3-му з 5 записів лишив би 1-2 у БД, а оператор бачив би помилку
 * «нічого не збережено».
 */
export async function saveReadings(input: SaveReadingsInput): Promise<{ saved: number }> {
  const { year, month } = input

  // Фаза 1: перевірка всіх записів до будь-якого запису.
  for (const e of input.entries) {
    const readings = await prisma.meterReading.findMany({ where: { premisesId: e.premisesId } })
    const prev = findPreviousReading(readings, year, month)
    assertNotDecreased(e.premisesId, 'електрики', e.electricity, prev ? prev.electricity.toString() : null, e.electricityReplaced)
    assertNotDecreased(e.premisesId, 'води', e.water, prev ? prev.water.toString() : null, e.waterReplaced)
  }

  // Фаза 2: усі upsert-и в одній транзакції (все-або-нічого).
  const data = (e: ReadingEntry) => ({
    electricity: e.electricity, water: e.water,
    electricityReplaced: e.electricityReplaced ?? false,
    electricityReplacedInitial: e.electricityReplacedInitial ?? null,
    waterReplaced: e.waterReplaced ?? false,
    waterReplacedInitial: e.waterReplacedInitial ?? null,
  })
  await prisma.$transaction(
    input.entries.map((e) =>
      prisma.meterReading.upsert({
        where: { premisesId_year_month: { premisesId: e.premisesId, year, month } },
        update: data(e),
        create: { premisesId: e.premisesId, year, month, ...data(e) },
      }),
    ),
  )
  return { saved: input.entries.length }
}
