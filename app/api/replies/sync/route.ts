import { requireAuth } from "@/lib/guard"
import { syncReplies } from "@/lib/replies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as { pageId?: string }

  try {
    const result = await syncReplies({ pageId: body.pageId })
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Reply sync failed." },
      { status: 422 }
    )
  }
}
