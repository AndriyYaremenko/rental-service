import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { ApiError, type ApiErrorCode, json, parseBody, route, toErrorResponse } from '@/server/http'

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

describe('таблиця статусів — кожен код', () => {
  const cases: Array<[ApiErrorCode, number]> = [
    ['VALIDATION_FAILED', 400],
    ['UNAUTHORIZED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['LEASE_OVERLAP', 409],
    ['INVOICE_EXISTS', 409],
    ['READING_DECREASED', 409],
  ]
  it.each(cases)('%s → %i', (code, status) => {
    expect(new ApiError(code, 'msg').status).toBe(status)
    expect(toErrorResponse(new ApiError(code, 'msg')).status).toBe(status)
  })
})

describe('zodFields — вкладений шлях', () => {
  it('складений шлях поля кладеться через крапку, не кому', async () => {
    const nested = z.object({ lease: z.object({ startDate: z.string().min(1) }) })
    await expect(parseBody(req({ lease: { startDate: '' } }), nested)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { 'lease.startDate': expect.any(String) },
    })
  })
})

describe('route() і json()', () => {
  const fakeReq = new Request('http://t/') as never
  const noCtx = undefined as never

  it('json віддає заданий статус і тіло', async () => {
    const res = json({ a: 1 }, 201)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ a: 1 })
  })

  it('route ловить синхронний throw ApiError у envelope', async () => {
    const handler = route((() => {
      throw new ApiError('NOT_FOUND', 'Немає')
    }) as never)
    const res = await handler(fakeReq, noCtx)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Немає' } })
  })

  it('route ловить async-реджект у envelope', async () => {
    const handler = route(async () => {
      throw new ApiError('CONFLICT', 'Зайнято')
    })
    const res = await handler(fakeReq, noCtx)
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('CONFLICT')
  })

  it('route пропускає успішну відповідь без змін', async () => {
    const handler = route(async () => json({ ok: true }))
    const res = await handler(fakeReq, noCtx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('route мапить невідому помилку в 500 без витоку деталей', async () => {
    const handler = route(async () => {
      throw new Error('секретний стек')
    })
    const res = await handler(fakeReq, noCtx)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: { code: 'INTERNAL', message: 'Внутрішня помилка сервера' } })
  })
})
