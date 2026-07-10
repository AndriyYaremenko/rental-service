import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { verifyPassword } from './password'
import { signSession, verifySession } from './session'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'USER'
}

const UNAUTHORIZED = () => new ApiError('UNAUTHORIZED', 'Потрібна авторизація')

function toSessionUser(u: { id: string; email: string; name: string; role: string }): SessionUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role === 'ADMIN' ? 'ADMIN' : 'USER' }
}

export async function authenticate(email: string, password: string): Promise<{ user: SessionUser; token: string }> {
  const user = await prisma.user.findUnique({ where: { email } })
  // Однакова помилка для «немає користувача» і «неправильний пароль» — не
  // розкриваємо, які email зареєстровані.
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    throw UNAUTHORIZED()
  }
  const sessionUser = toSessionUser(user)
  const token = await signSession({ sub: user.id, role: sessionUser.role })
  return { user: sessionUser, token }
}

export async function userFromToken(token: string | undefined): Promise<SessionUser> {
  if (!token) throw UNAUTHORIZED()
  const claims = await verifySession(token)
  if (!claims) throw UNAUTHORIZED()
  const user = await prisma.user.findUnique({ where: { id: claims.sub } })
  if (!user || !user.isActive) throw UNAUTHORIZED()
  return toSessionUser(user)
}
