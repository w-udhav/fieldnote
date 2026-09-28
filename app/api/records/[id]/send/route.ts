import { syncRecord } from "@/lib/file-brief"
import { requireAuth } from "@/lib/guard"
import { applyNotionDraft, loadNotionForRecord } from "@/lib/merge-notion"
import { sendMail } from "@/lib/mail"
import { getDatabaseSchema, updateNotionMailMeta } from "@/lib/notion"
import { loadSettings, resolveResumePath } from "@/lib/settings"
import { access } from "node:fs/promises"
import { getRecord, saveRecord } from "@/lib/store"
import type { EmailDraft } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth(request)
  if (denied) return denied
  const { id } = await context.params
  const existing = await getRecord(id)
  if (!existing) return Response.json({ error: "That brief is not in the pipeline." }, { status: 404 })

  const notion = await loadNotionForRecord(existing)
  const withNotionDraft = applyNotionDraft(existing, notion)

  const body = (await request.json().catch(() => ({}))) as { draft?: Partial<EmailDraft> }
  const draft: EmailDraft = {
    to: body.draft?.to?.trim() || withNotionDraft.draft.to,
    subject: body.draft?.subject?.trim() || withNotionDraft.draft.subject,
    body: body.draft?.body ?? withNotionDraft.draft.body,
  }

  const settings = await loadSettings()
  const resumePath = resolveResumePath(settings)
  let attachments: { filename: string; path: string }[] | undefined
  try {
    await access(resumePath)
    attachments = [{ filename: "resume.pdf", path: resumePath }]
  } catch {
    attachments = undefined
  }

  try {
    const messageId = await sendMail(settings, draft, { attachments })
    const sentAt = new Date().toISOString()
    const sent = {
      ...existing,
      draft,
      draftEdited: true,
      status: "sent" as const,
      sentAt,
      sentMessageId: messageId,
      sendError: null,
      updatedAt: sentAt,
    }
    const record = await syncRecord(sent)

    const pageId = record.destinations.notion.pageId
    if (pageId && settings.notionToken && settings.notionDatabaseId) {
      const schema = await getDatabaseSchema(settings.notionToken, settings.notionDatabaseId)
      await updateNotionMailMeta(settings.notionToken, pageId, schema, {
        status: "sent",
        sentAt,
        sentMessageId: messageId,
        draft,
      })
    }

    return Response.json({ record, notion })
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
}
