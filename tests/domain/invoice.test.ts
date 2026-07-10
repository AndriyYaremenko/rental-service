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
