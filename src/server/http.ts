import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { checkCsrf, CSRF_COOKIE, CSRF_HEADER } from '@/server/csrf'
import { SESSION_COOKIE } from '@/server/auth/session'

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LEASE_OVERLAP'
  | 'INVOICE_EXISTS'
  | 'READING_DECREASED'
  | 'CSRF_FAILED'

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LEASE_OVERLAP: 409,
  INVOICE_EXISTS: 409,
  READING_DECREASED: 409,
  CSRF_FAILED: 403,
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }

  get status(): number {
    return STATUS[this.code]
  }
}

function envelope(code: string, message: string, fields?: Record<string, string>) {
  return { error: fields ? { code, message, fields } : { code, message } }
}

export function toErrorResponse(e: unknown): { status: number; body: unknown } {
  if (e instanceof ApiError) {
    return { status: e.status, body: envelope(e.code, e.message, e.fields) }
  }
  if (e instanceof ZodError) {
    return { status: 400, body: envelope('VALIDATION_FAILED', 'Дані не пройшли валідацію', zodFields(e)) }
  }
  // Невідома помилка: не віддаємо стек/деталі назовні.
  return { status: 500, body: envelope('INTERNAL', 'Внутрішня помилка сервера') }
}

function zodFields(e: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of e.issues) {
    fields[issue.path.join('.') || '_'] = issue.message
  }
  return fields
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError('VALIDATION_FAILED', 'Тіло запиту не є коректним JSON')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new ApiError('VALIDATION_FAILED', 'Дані не пройшли валідацію', zodFields(result.error))
  }
  return result.data
}

type Handler<Ctx = unknown> = (req: import('next/server').NextRequest, ctx: Ctx) => Promise<Response>

/** Обгортка route-handler'а: перетворює будь-яку кинуту помилку в envelope.
 *  Ctx — узагальнений, щоб роути з динамічними сегментами (`[id]`) могли
 *  типізувати `{ params: Promise<{ id: string }> }` замість `unknown`. */
export function route<Ctx = unknown>(fn: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      const ok = checkCsrf(
        req.method,
        req.cookies.get(SESSION_COOKIE)?.value,
        req.cookies.get(CSRF_COOKIE)?.value,
        req.headers.get(CSRF_HEADER) ?? undefined,
      )
      if (!ok) throw new ApiError('CSRF_FAILED', 'CSRF-перевірка не пройдена')
      return await fn(req, ctx)
    } catch (e) {
      const { status, body } = toErrorResponse(e)
      return NextResponse.json(body, { status })
    }
  }
}
