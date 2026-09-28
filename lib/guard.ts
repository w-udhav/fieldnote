import { isRequestAuthorized } from "./session"

export function requireAuth(request: Request) {
  if (isRequestAuthorized(request)) return null
  return Response.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 })
}
