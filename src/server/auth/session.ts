import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'rs_session'
const ALG = 'HS256'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 днів

export interface SessionClaims {
  sub: string
  role: 'ADMIN' | 'USER'
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('SESSION_SECRET не задано')
  return new TextEncoder().encode(value)
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

/** null на будь-якій помилці верифікації (підпис, строк, формат). */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.sub !== 'string') return null
    const role = payload.role
    if (role !== 'ADMIN' && role !== 'USER') return null
    return { sub: payload.sub, role }
  } catch {
    return null
  }
}
