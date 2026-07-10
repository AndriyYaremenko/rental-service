import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { ApiError, parseBody, toErrorResponse } from '@/server/http'

const req = (body: unknown) =>
  new Request('http://t/api', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

describe('toErrorResponse', () => {
  it('ApiError → код, статус, повідомлення в envelope', () => {
    const { status, body } = toErrorResponse(new ApiError('LEASE_OVERLAP', 'Перетин', { startDate: 'зайнято' }))
    expect(status).toBe(409)
    expect(body).toEqual({ error: { code: 'LEASE_OVERLAP', message: 'Перетин', fields: { startDate: 'зайнято' } } })
  })

  it('ApiError без fields не додає порожнє поле', () => {
    const { body } = toErrorResponse(new ApiError('NOT_FOUND', 'Немає'))
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'Немає' } })
  })

  it('невідома помилка → 500 без витоку повідомлення', () => {
    const { status, body } = toErrorResponse(new Error('деталь стеку'))
    expect(status).toBe(500)
    expect(body).toEqual({ error: { code: 'INTERNAL', message: 'Внутрішня помилка сервера' } })
  })
})

describe('parseBody', () => {
  const schema = z.object({ name: z.string().min(1) })

  it('повертає розібрані дані', async () => {
    expect(await parseBody(req({ name: 'Оренда' }), schema)).toEqual({ name: 'Оренда' })
  })

  it('невалідне тіло → ApiError VALIDATION_FAILED із fields по шляху', async () => {
    await expect(parseBody(req({ name: '' }), schema)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { name: expect.any(String) },
    })
  })

  it('некоректний JSON → VALIDATION_FAILED', async () => {
    const bad = new Request('http://t/api', { method: 'POST', body: '{не json' })
    await expect(parseBody(bad, schema)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
  })
})
