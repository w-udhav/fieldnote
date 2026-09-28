import { isAuthorized, isLocalRequest } from "@/lib/guard"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const key = Boolean(process.env.FIELDNOTE_KEY)
  if (!key && !isLocalRequest(request)) {
    return Response.json({ mode: "blocked", authorized: false })
  }
  if (key) {
    return Response.json({ mode: "key", authorized: isAuthorized(request) })
  }
  return Response.json({ mode: "open", authorized: true })
}
