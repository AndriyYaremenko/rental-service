export class ClientApiError extends Error {
  constructor(readonly code: string, message: string, readonly fields?: Record<string, string>) {
    super(message)
  }
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (res.ok) {
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }
  let code = 'INTERNAL', message = 'Помилка сервера', fields: Record<string, string> | undefined
  try {
    const body = await res.json()
    if (body?.error) { code = body.error.code ?? code; message = body.error.message ?? message; fields = body.error.fields }
  } catch { /* не JSON — лишаємо дефолт */ }
  throw new ClientApiError(code, message, fields)
}
