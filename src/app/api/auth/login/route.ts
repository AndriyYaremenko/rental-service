import { cookies } from 'next/headers'
import { authenticate } from '@/server/auth/core'
import { SESSION_COOKIE, cookieOptions } from '@/server/auth/session'
import { json, parseBody, route } from '@/server/http'
import { loginSchema } from '@/lib/validation/auth'

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginSchema)
  const { user, token } = await authenticate(email, password)
  ;(await cookies()).set(SESSION_COOKIE, token, cookieOptions())
  return json(user)
})
