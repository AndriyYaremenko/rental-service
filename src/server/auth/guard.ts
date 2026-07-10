import { cookies } from 'next/headers'
import { ApiError } from '@/server/http'
import { SESSION_COOKIE } from './session'
import { userFromToken, type SessionUser } from './core'

export async function requireUser(): Promise<SessionUser> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return userFromToken(token)
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') throw new ApiError('FORBIDDEN', 'Потрібні права адміністратора')
  return user
}
