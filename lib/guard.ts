function hostOf(request: Request) {
  const forwarded = request.headers.get("x-forwarded-host")
  const raw = (forwarded || request.headers.get("host") || "").split(",")[0]?.trim() ?? ""
  return raw.toLowerCase()
}

export function isLocalRequest(request: Request) {
  const host = hostOf(request)
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
}

export function isAuthorized(request: Request) {
  const key = process.env.FIELDNOTE_KEY
  if (!key) return isLocalRequest(request)
  return request.headers.get("x-fieldnote-key") === key
}

export function unauthorizedResponse(request: Request) {
  if (!process.env.FIELDNOTE_KEY && !isLocalRequest(request)) {
    return Response.json(
      {
        error:
          "This desk is locked until FIELDNOTE_KEY is set. Without it, a public deploy could send mail with your saved login.",
        code: "locked",
      },
      { status: 403 }
    )
  }
  return Response.json(
    { error: "Enter the desk key to continue.", code: "unauthorized" },
    { status: 401 }
  )
}

export function requireAuth(request: Request) {
  if (isAuthorized(request)) return null
  return unauthorizedResponse(request)
}
