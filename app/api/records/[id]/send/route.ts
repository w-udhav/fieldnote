import { syncRecord } from "@/lib/file-brief"
import { requireAuth } from "@/lib/guard"
import { sendMail } from "@/lib/mail"
import { loadSettings } from "@/lib/settings"
import { getRecord, saveRecord } from "@/lib/store"
import type { EmailDraft } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requireAuth(request)
  if (denied) return denied
  const { id } = await context.params
  const existing = await getRecord(id)
  if (!existing) return Response.json({ error: "That brief is not in the pipeline." }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as { draft?: Partial<EmailDraft> }
  const draft: EmailDraft = {
    to: body.draft?.to?.trim() || existing.draft.to,
    subject: body.draft?.subject?.trim() || existing.draft.subject,
    body: body.draft?.body ?? existing.draft.body,
  }

  const settings = await loadSettings()
  try {
    await sendMail(settings, draft)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mail could not be sent."
    const saved = await saveRecord({
      ...existing,
      draft,
      draftEdited: true,
      status: "send_failed",
      sendError: message,
      updatedAt: new Date().toISOString(),
    })
    return Response.json({ error: message, record: saved }, { status: 422 })
  }

  const sent = {
    ...existing,
    draft,
    draftEdited: true,
    status: "sent" as const,
    sentAt: new Date().toISOString(),
    sendError: null,
    updatedAt: new Date().toISOString(),
  }
  const record = await syncRecord(sent)
  return Response.json({ record })
}
