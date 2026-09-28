import { requireAuth } from "@/lib/guard"
import { listRecords } from "@/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  const records = await listRecords()
  return Response.json({ records })
}
