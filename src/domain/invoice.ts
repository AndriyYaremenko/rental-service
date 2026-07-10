import { consumption, consumptionBase } from './consumption'
import { roundHalfUp } from './money'
import type { InvoiceLines, LeaseTerms, MeterSideInput, TariffRates } from './types'

export interface BuildInvoiceInput {
  electricity: MeterSideInput
  water: MeterSideInput
  terms: LeaseTerms
  rates: TariffRates
}

/**
 * Рядки рахунку за місяць.
 *
 * Повертає рівно те, що зберігається в рядку Invoice: заморожені ставки,
 * базу й поточний показник кожного ресурсу, споживання і суми. Шар API
 * розпаковує результат у Prisma без додаткових обчислень, тож збережений
 * рядок не може розійтися з тим, що порахував домен.
 *
 * Кожен рядок округлюється до копійки окремо, а підсумок — сума вже
 * округлених цілих, тому загальна сума не «пливе» відносно рядків.
 */
export function buildInvoice(input: BuildInvoiceInput): InvoiceLines {
  const prevElectricity = consumptionBase(input.electricity)
  const prevWater = consumptionBase(input.water)
  const electricityUsed = consumption(input.electricity)
  const waterUsed = consumption(input.water)

  const electricityKop = roundHalfUp(electricityUsed.times(input.rates.electricityRateKop))
  const waterKop = roundHalfUp(waterUsed.times(input.rates.waterRateKop))
  const { rentKop, garbageKop } = input.terms

  return {
    electricityRateKop: input.rates.electricityRateKop,
    waterRateKop: input.rates.waterRateKop,
    prevElectricity,
    currElectricity: input.electricity.curr,
    electricityUsed,
    prevWater,
    currWater: input.water.curr,
    waterUsed,
    rentKop,
    electricityKop,
    waterKop,
    garbageKop,
    totalKop: rentKop + electricityKop + waterKop + garbageKop,
  }
}
