import { describe, expect, it } from 'vitest'
import { toCsv } from '@/server/csv'

describe('toCsv', () => {
  it('склеює заголовки й рядки через кому, рядки — CRLF', () => {
    const csv = toCsv(['a', 'b'], [[1, 'x'], [2, 'y']])
    expect(csv).toBe('\uFEFFa,b\r\n1,x\r\n2,y')
  })

  it('BOM (U+FEFF) попереду — щоб Excel відкрив UTF-8 кирилицю коректно', () => {
    expect(toCsv(['Орендар'], [['Іван']]).startsWith('\uFEFF')).toBe(true)
  })

  it('екранує значення з комою, лапками чи переносом (RFC 4180)', () => {
    const csv = toCsv(['c'], [['має, кому'], ['має "лапки"'], ['має\nперенос']])
    expect(csv).toContain('"має, кому"')
    expect(csv).toContain('"має ""лапки"""')
    expect(csv).toContain('"має\nперенос"')
  })

  it('екранує і одиночний CR (\\r), не лише LF', () => {
    // Клас /[",\n\r]/ включає \r; без цього тесту мутант, що прибирає \r, виживає.
    expect(toCsv(['c'], [['має\rповернення']])).toContain('"має\rповернення"')
  })

  it('лише заголовки, коли рядків немає — BOM + заголовок, без хвостового CRLF', () => {
    expect(toCsv(['Орендар', 'Борг'], [])).toBe('\uFEFFОрендар,Борг')
  })
})
