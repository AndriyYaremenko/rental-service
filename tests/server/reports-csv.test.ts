import { describe, expect, it } from 'vitest'
import { debtsToCsv, monthlyToCsv } from '@/server/reports-csv'
import type { DebtRow, MonthlyReport } from '@/server/services/reports'

// Розбивка домен→CSV раніше жила в нетестованому роуті. Ці тести пінують
// колонки, порядок, fromKop-суми й український статус — щоб мовчазний
// swap колонок чи зламаний мапінг статусу не потрапив у грошовий звіт.
const strip = (csv: string) => (csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv).split('\r\n')

describe('debtsToCsv', () => {
  it('заголовок і грн-суми через fromKop у фіксованому порядку колонок', () => {
    const rows: DebtRow[] = [
      { leaseId: 'L1', tenantName: 'Іван', premisesLabel: 'Локація · A1', invoicedKop: 100_000, paidKop: 40_000, debtKop: 60_000, advanceKop: 0 },
    ]
    const lines = strip(debtsToCsv(rows))
    // поля з комою екрануються лапками (RFC 4180)
    expect(lines[0]).toBe('Орендар,Приміщення,"Нараховано, грн","Оплачено, грн","Борг, грн","Аванс, грн"')
    // саме invoiced=1000, paid=400, debt=600, advance=0 — ловить swap колонок
    expect(lines[1]).toBe('Іван,Локація · A1,1000.00,400.00,600.00,0.00')
  })

  it('порожній звіт → лише заголовок', () => {
    expect(strip(debtsToCsv([]))).toEqual(['Орендар,Приміщення,"Нараховано, грн","Оплачено, грн","Борг, грн","Аванс, грн"'])
  })
})

describe('monthlyToCsv', () => {
  const mk = (status: 'UNPAID' | 'PARTIAL' | 'PAID', totalKop = 100_000): MonthlyReport => ({
    year: 2029, month: 6, totalInvoicedKop: totalKop, count: 1,
    rows: [{ leaseId: 'L1', tenantName: 'Іван', premisesLabel: 'Локація · A1', totalKop, status }],
  })

  it('сума грн і статус українською у правильних колонках', () => {
    const lines = strip(monthlyToCsv(mk('PARTIAL')))
    expect(lines[0]).toBe('Орендар,Приміщення,"Сума, грн",Статус')
    expect(lines[1]).toBe('Іван,Локація · A1,1000.00,Частково')
  })

  it('усі три статуси мапляться українською (ловить зламаний STATUS_UK)', () => {
    expect(strip(monthlyToCsv(mk('UNPAID', 0)))[1]).toBe('Іван,Локація · A1,0.00,Не оплачено')
    expect(strip(monthlyToCsv(mk('PAID', 0)))[1]).toBe('Іван,Локація · A1,0.00,Оплачено')
    expect(strip(monthlyToCsv(mk('PARTIAL', 0)))[1]).toBe('Іван,Локація · A1,0.00,Частково')
  })
})
