import { requireAuth } from "@/lib/guard"
import { queryBriefs } from "@/lib/notion"
import { loadSettings } from "@/lib/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const settings = await loadSettings()
  if (!settings.notionToken || !settings.notionDatabaseId) {
    return Response.json(
      { error: "Connect Notion in Settings to use the dashboard." },
      { status: 400 }
    )
  }

  try {
    const { briefs } = await queryBriefs(settings.notionToken, settings.notionDatabaseId)
    return Response.json({ briefs })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load Notion briefs." },
      { status: 422 }
    )
  }
}
