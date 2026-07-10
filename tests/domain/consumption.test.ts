import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { consumption } from '@/domain/consumption'
import { NegativeConsumptionError, NoPreviousReadingError } from '@/domain/errors'
import type { MeterSideInput } from '@/domain/types'

const side = (o: Partial<MeterSideInput>): MeterSideInput => ({
  curr: new Decimal(0),
  prev: null,
  replaced: false,
  replacedInitial: null,
  ...o,
})

describe('consumption', () => {
  it('віднімає попередній показник від поточного', () => {
    const used = consumption(side({ curr: new Decimal(150), prev: new Decimal(100) }))
    expect(used.toString()).toBe('50')
  })

  it('працює з дробовими показниками води', () => {
    const used = consumption(side({ curr: new Decimal('12.750'), prev: new Decimal('9.250') }))
    expect(used.toString()).toBe('3.5')
  })

  it('падає, якщо попереднього показника немає', () => {
    expect(() => consumption(side({ curr: new Decimal(150) })))
      .toThrow(NoPreviousReadingError)
  })

  it('падає на відʼємному споживанні без заміни лічильника', () => {
    expect(() => consumption(side({ curr: new Decimal(90), prev: new Decimal(100) })))
      .toThrow(NegativeConsumptionError)
  })

  it('при заміні лічильника рахує від нуля, ігноруючи старий показник', () => {
    const used = consumption(side({
      curr: new Decimal(30),
      prev: new Decimal(900),
      replaced: true,
      replacedInitial: new Decimal(0),
    }))
    expect(used.toString()).toBe('30')
  })

  it('при заміні рахує від початкового показника нового лічильника', () => {
    const used = consumption(side({
      curr: new Decimal(30),
      prev: new Decimal(900),
      replaced: true,
      replacedInitial: new Decimal(5),
    }))
    expect(used.toString()).toBe('25')
  })

  it('при заміні без вказаного початкового показника вважає його нулем', () => {
    const used = consumption(side({
      curr: new Decimal(30),
      prev: new Decimal(900),
      replaced: true,
      replacedInitial: null,
    }))
    expect(used.toString()).toBe('30')
  })

  it('падає, якщо поточний менший за початковий показник нового лічильника', () => {
    expect(() => consumption(side({
      curr: new Decimal(3),
      prev: null,
      replaced: true,
      replacedInitial: new Decimal(5),
    }))).toThrow(NegativeConsumptionError)
  })
})
