import { createHmac, timingSafeEqual } from "node:crypto"

export const SESSION_COOKIE = "fieldnote_session"

export function deskPassword() {
  return process.env.FIELDNOTE_PASSWORD?.trim() ?? ""
}

export function sessionToken() {
  const password = deskPassword()
  if (!password) return ""
  return createHmac("sha256", password).update("fieldnote-session-v1").digest("base64url")
}

export function cookieMatches(value: string | undefined | null) {
  const expected = sessionToken()
  if (!expected || !value) return false
  const left = Buffer.from(value)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function isLocalHost(host: string) {
  const raw = host.split(",")[0]?.trim().toLowerCase() ?? ""
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(raw)
}

export function requestHost(request: { headers: { get(name: string): string | null } }) {
  return request.headers.get("x-forwarded-host") || request.headers.get("host") || ""
}

export function readSessionCookie(header: string | null) {
  if (!header) return ""
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="))
  }
  return ""
}

export function isRequestAuthorized(request: {
  headers: { get(name: string): string | null }
}) {
  if (cookieMatches(readSessionCookie(request.headers.get("cookie")))) return true
  if (!deskPassword() && isLocalHost(requestHost(request))) return true
  return false
}

export function sessionCookieHeader(token: string, secure: boolean) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`,
  ]
  if (secure) parts.push("Secure")
  return parts.join("; ")
}

export function clearSessionCookieHeader(secure: boolean) {
  const parts = [`${SESSION_COOKIE}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"]
  if (secure) parts.push("Secure")
  return parts.join("; ")
}
