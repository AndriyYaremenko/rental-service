import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LEASE_OVERLAP'
  | 'INVOICE_EXISTS'
  | 'READING_DECREASED'

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LEASE_OVERLAP: 409,
  INVOICE_EXISTS: 409,
  READING_DECREASED: 409,
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

type Handler = (req: import('next/server').NextRequest, ctx: unknown) => Promise<Response>

/** Обгортка route-handler'а: перетворює будь-яку кинуту помилку в envelope. */
export function route(fn: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (e) {
      const { status, body } = toErrorResponse(e)
      return NextResponse.json(body, { status })
    }
  }
}
