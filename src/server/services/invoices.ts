import { Decimal } from 'decimal.js'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { planMonthlyInvoices, type GenLease, type GenReading } from '@/domain/generation'
import { allocatePayments } from '@/domain/allocation'
import type { InvoiceForAllocation, InvoiceStatus } from '@/domain/types'
import { Prisma } from '@/generated/prisma/client'

/**
 * Формує нарахування за (year, month): завантажує договори/показники/тарифи/
 * наявні рахунки, кличе чистий planMonthlyInvoices і персистить план у
 * транзакції (все-або-нічого). Заморожені суми й показники — рядки, які
 * порахував домен, а не БД.
 */
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
