import { clearSessionCookieHeader } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secure = new URL(request.url).protocol === "https:"
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookieHeader(secure) } }
  )
}
