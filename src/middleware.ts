import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/session'
import { CSRF_COOKIE } from '@/server/csrf'

export function middleware(req: NextRequest) {
  // /login навмисно виключено з matcher (нижче), тож сюди він не потрапляє —
  // це також розриває цикл редіректів для протухлого cookie (layout кидає
  // /→/login, а middleware НЕ кидає /login→/). Тому лишаємо лише один напрямок.
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value)
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  const res = NextResponse.next()
  // Ставимо non-httpOnly csrf-cookie (double-submit), щоб клієнт міг його
  // прочитати й повернути в X-CSRF-Token на мутаціях. Лише якщо ще немає.
  if (!req.cookies.get(CSRF_COOKIE)?.value) {
    res.cookies.set(CSRF_COOKIE, crypto.randomUUID(), {
      httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
    })
  }
  return res
}

export const config = {
  // усе, крім api, статики, логіну-ассетів
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
}
