import type { Decimal } from 'decimal.js'

/** Цілі копійки. Гроші в системі не бувають дробовими. */
export type Kop = number

export interface MeterSideInput {
  curr: Decimal
  prev: Decimal | null
  replaced: boolean
  replacedInitial: Decimal | null
}

export interface LeaseTerms {
  rentKop: Kop
  garbageKop: Kop
}

export interface TariffRates {
  electricityRateKop: Kop
  waterRateKop: Kop
}

export interface InvoiceLines {
  electricityUsed: Decimal
  waterUsed: Decimal
  rentKop: Kop
  electricityKop: Kop
  waterKop: Kop
  garbageKop: Kop
  totalKop: Kop
}

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

export interface InvoiceForAllocation {
  id: string
  year: number
  month: number
  createdAt: Date
  totalKop: Kop
}

export interface AllocationEntry {
  coveredKop: Kop
  status: InvoiceStatus
}

export interface AllocationResult {
  byInvoiceId: Map<string, AllocationEntry>
  advanceKop: Kop
}

/** endDate === null означає безстроковий період. */
export interface Period {
  startDate: Date
  endDate: Date | null
}
