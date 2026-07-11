import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/session'

export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value)
  const isLogin = req.nextUrl.pathname === '/login'
  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
}

export const config = {
  // усе, крім api, статики, логіну-ассетів
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
}
