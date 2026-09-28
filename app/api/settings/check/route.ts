import { requireAuth } from "@/lib/guard"
import { verifyMail } from "@/lib/mail"
import { checkNotion } from "@/lib/notion"
import { loadSettings } from "@/lib/settings"
import { pushSheet } from "@/lib/sheets"
import type { BriefRecord } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied
  const body = (await request.json()) as { target?: string }
  const settings = await loadSettings()

  try {
    if (body.target === "notion") {
      if (!settings.notionToken || !settings.notionDatabaseId) {
        return Response.json({ error: "Add a Notion token and database ID first." }, { status: 400 })
      }
      const result = await checkNotion(settings.notionToken, settings.notionDatabaseId)
      return Response.json({ ok: true, detail: `Connected to “${result.title}”.` })
    }
    if (body.target === "sheets") {
      if (!settings.sheetsWebhookUrl) {
        return Response.json({ error: "Add a Google Apps Script web app URL first." }, { status: 400 })
      }
      await pushSheet(settings.sheetsWebhookUrl, {} as BriefRecord, true)
      return Response.json({ ok: true, detail: "The sheet webhook answered." })
    }
    if (body.target === "smtp") {
      await verifyMail(settings)
      return Response.json({ ok: true, detail: "SMTP login succeeded. No message was sent." })
    }
    return Response.json({ error: "Unknown check." }, { status: 400 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The check failed." },
      { status: 422 }
    )
  }
}
