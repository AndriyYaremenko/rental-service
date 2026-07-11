import { Decimal } from 'decimal.js'
import { prisma } from '@/server/db'
import { planMonthlyInvoices, type GenLease, type GenReading } from '@/domain/generation'

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
