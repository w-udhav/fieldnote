import { requireAuth } from "@/lib/guard"
import { assertSheetsWebhook, loadSettings, saveSettings, toPublic } from "@/lib/settings"
import type { Settings } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  const settings = await loadSettings()
  return Response.json({ settings: toPublic(settings) })
}

export async function PUT(request: Request) {
  const denied = requireAuth(request)
  if (denied) return denied
  const body = (await request.json()) as Partial<Settings>
  try {
    if (typeof body.sheetsWebhookUrl === "string") assertSheetsWebhook(body.sheetsWebhookUrl)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Check the sheet webhook." },
      { status: 400 }
    )
  }
  const port = body.smtpPort === undefined ? undefined : Number(body.smtpPort)
  const saved = await saveSettings({
    ...body,
    smtpPort: Number.isFinite(port) ? port : undefined,
  })
  return Response.json({ settings: toPublic(saved) })
}
