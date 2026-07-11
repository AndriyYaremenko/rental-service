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
