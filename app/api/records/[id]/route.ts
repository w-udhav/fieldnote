import { requireAuth } from "@/lib/guard"
import { applyNotionDraft, loadNotionForRecord } from "@/lib/merge-notion"
import { ensureLocalRecord } from "@/lib/notion-record"
import { getRecord, removeRecord, saveRecord } from "@/lib/store"
import type { EmailDraft } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DraftPatch = Partial<EmailDraft>

function cleanDraft(draft: DraftPatch, current: EmailDraft): EmailDraft {
  return {
    to: typeof draft.to === "string" ? draft.to.trim() : current.to,
    subject: typeof draft.subject === "string" ? draft.subject.trim() : current.subject,
    body: typeof draft.body === "string" ? draft.body : current.body,
  }
}

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const denied = await requireAuth(request)
  if (denied) return denied
  const { id } = await context.params
  const record = await ensureLocalRecord(id)
  if (!record) return Response.json({ error: "That brief is not in the pipeline." }, { status: 404 })
  const notion = await loadNotionForRecord(record)
  const merged = applyNotionDraft(record, notion)
  return Response.json({ record: merged, notion })
}

export async function PATCH(request: Request, context: Context) {
  const denied = await requireAuth(request)
  if (denied) return denied
  const { id } = await context.params
  const record = await getRecord(id)
  if (!record) return Response.json({ error: "That brief is not in the pipeline." }, { status: 404 })

  const body = (await request.json()) as { draft?: DraftPatch }
  const draft = cleanDraft(body.draft ?? {}, record.draft)
  const saved = await saveRecord({
    ...record,
    draft,
    draftEdited: true,
    updatedAt: new Date().toISOString(),
  })
  return Response.json({ record: saved })
}

export async function DELETE(request: Request, context: Context) {
  const denied = await requireAuth(request)
  if (denied) return denied
  const { id } = await context.params
  const removed = await removeRecord(id)
  if (!removed) return Response.json({ error: "That brief is not in the pipeline." }, { status: 404 })
  return Response.json({ ok: true })
}
