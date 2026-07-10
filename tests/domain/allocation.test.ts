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

  it('нульовий рахунок вважається оплаченим, а не вічним боргом', () => {
    // covered === 0 і covered === totalKop істинні одночасно.
    // Порядок перевірок у тернарнику вирішує; має перемогти PAID.
    const zero = inv('zero', 2026, 1, 0)
    const r = allocatePayments([zero], 0)
    expect(r.byInvoiceId.get('zero')!).toEqual({ coveredKop: 0, status: 'PAID' })
    expect(r.advanceKop).toBe(0)
  })

  it("нульовий рахунок не з'їдає оплату", () => {
    const zero = inv('zero', 2026, 1, 0)
    const r = allocatePayments([zero, jan], 100_000)
    expect(r.byInvoiceId.get('zero')!.status).toBe('PAID')
    expect(r.byInvoiceId.get('jan')!.status).toBe('PAID')
    expect(r.advanceKop).toBe(0)
  })

  it('createdAt розводить рахунки за той самий місяць', () => {
    const early = { id: 'early', year: 2026, month: 1, totalKop: 100_000,
                    createdAt: new Date(Date.UTC(2026, 0, 5)) }
    const late = { id: 'late', year: 2026, month: 1, totalKop: 100_000,
                   createdAt: new Date(Date.UTC(2026, 0, 20)) }
    const r = allocatePayments([late, early], 100_000)
    expect(r.byInvoiceId.get('early')!.status).toBe('PAID')
    expect(r.byInvoiceId.get('late')!.status).toBe('UNPAID')
  })
})
