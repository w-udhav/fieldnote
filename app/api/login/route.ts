import { deskPassword, sessionCookieHeader, sessionToken } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const password = deskPassword()
  if (!password) {
    return Response.json(
      { error: "Set FIELDNOTE_PASSWORD before signing in from this host." },
      { status: 400 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string }
  if (body.password !== password) {
    return Response.json({ error: "Wrong password." }, { status: 401 })
  }

  const secure = new URL(request.url).protocol === "https:"
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionCookieHeader(sessionToken(), secure) } }
  )
}
