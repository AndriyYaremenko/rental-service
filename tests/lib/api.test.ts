import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ClientApiError } from '@/lib/api'

afterEach(() => vi.restoreAllMocks())
const mockFetch = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })))

describe('apiFetch', () => {
  it('повертає розпарсене тіло на 2xx', async () => {
    mockFetch(200, { id: '1', name: 'Іван' })
    expect(await apiFetch('/api/x')).toEqual({ id: '1', name: 'Іван' })
  })

  it('кидає ClientApiError із кодом і полями на помилку', async () => {
    mockFetch(400, { error: { code: 'VALIDATION_FAILED', message: 'Погано', fields: { email: 'Обовʼязкове' } } })
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { email: 'Обовʼязкове' } })
  })

  it('кидає ClientApiError навіть коли тіло не JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })))
    await expect(apiFetch('/api/x')).rejects.toBeInstanceOf(ClientApiError)
  })
})
