import { requireAuth } from "@/lib/guard"
import { resetNotionSchema } from "@/lib/notion"
import { loadSettings, saveSettings } from "@/lib/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as {
    notionToken?: string
    notionDatabaseId?: string
  }
  const current = await loadSettings()
  const notionToken = body.notionToken?.trim() || current.notionToken
  const notionDatabaseId = body.notionDatabaseId?.trim() || current.notionDatabaseId
  if (!notionToken || !notionDatabaseId) {
    return Response.json(
      { error: "Add a Notion token and database ID first, then save." },
      { status: 400 }
    )
  }

  if (body.notionToken?.trim() || body.notionDatabaseId?.trim()) {
    await saveSettings({
      notionToken: body.notionToken?.trim() || undefined,
      notionDatabaseId: body.notionDatabaseId?.trim() || undefined,
    })
  }

  try {
    const result = await resetNotionSchema(notionToken, notionDatabaseId)
    return Response.json({
      ok: true,
      detail: `Replaced the database columns. ${result.columns} Fieldnote columns are in place. The title column is Role.`,
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update the Notion database." },
      { status: 422 }
    )
  }
}
