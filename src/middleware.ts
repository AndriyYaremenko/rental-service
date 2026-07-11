import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/session'

export function middleware(req: NextRequest) {
  // /login навмисно виключено з matcher (нижче), тож сюди він не потрапляє —
  // це також розриває цикл редіректів для протухлого cookie (layout кидає
  // /→/login, а middleware НЕ кидає /login→/). Тому лишаємо лише один напрямок.
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value)
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  // усе, крім api, статики, логіну-ассетів
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
}
