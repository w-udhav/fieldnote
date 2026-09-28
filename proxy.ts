import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { deskPassword, isRequestAuthorized } from "@/lib/session"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === "/api/login" || pathname === "/api/logout") return NextResponse.next()

  const signedIn = isRequestAuthorized(request)
  const isLogin = pathname === "/login"

  if (!signedIn && !isLogin) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (signedIn && isLogin && deskPassword()) {
    const url = request.nextUrl.clone()
    url.pathname = "/pipeline"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
