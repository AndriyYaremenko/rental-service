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
