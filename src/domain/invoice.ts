import { consumption } from './consumption'
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
 * Кожен рядок округлюється до копійки окремо, а підсумок є сумою вже
 * округлених цілих. Тому загальна сума не «пливе» відносно рядків,
 * які бачить орендар у роздруківці.
 */
export function buildInvoice(input: BuildInvoiceInput): InvoiceLines {
  const electricityUsed = consumption(input.electricity)
  const waterUsed = consumption(input.water)

  const electricityKop = roundHalfUp(electricityUsed.times(input.rates.electricityRateKop))
  const waterKop = roundHalfUp(waterUsed.times(input.rates.waterRateKop))
  const { rentKop, garbageKop } = input.terms

  return {
    electricityUsed,
    waterUsed,
    rentKop,
    electricityKop,
    waterKop,
    garbageKop,
    totalKop: rentKop + electricityKop + waterKop + garbageKop,
  }
}
