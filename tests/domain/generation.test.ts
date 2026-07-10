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
