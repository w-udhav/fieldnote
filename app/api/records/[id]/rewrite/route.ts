import { requireAuth } from "@/lib/guard"
import { applyNotionDraft, loadNotionForRecord } from "@/lib/merge-notion"
import { getDatabaseSchema, pagePlainText, updateNotionWriter } from "@/lib/notion"
import { loadSettings, resolveWriterProfile } from "@/lib/settings"
import { getRecord, saveRecord } from "@/lib/store"
import { requestWriterDraft, resolveWriterSystem, writerPrompt } from "@/lib/writer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 180

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth(request)
  if (denied) return denied
  const { id } = await context.params
  const record = await getRecord(id)
  if (!record) return Response.json({ error: "That brief is not in the pipeline." }, { status: 404 })
  if (record.status === "sent") {
    return Response.json({ error: "This brief was already sent." }, { status: 409 })
  }

  const settings = await loadSettings()
  const notion = await loadNotionForRecord(record)
  let description = record.description
  if (notion && settings.notionToken) {
    try {
      const pageText = await pagePlainText(settings.notionToken, notion.pageId)
      if (pageText.trim()) description = pageText
    } catch {
      description = record.description
    }
  }

  try {
    const written = await requestWriterDraft({
      system: resolveWriterSystem(settings.writerSystemPrompt),
      user: writerPrompt({
        profile: await resolveWriterProfile(settings),
        title: notion?.title || record.title,
        company: notion?.company || record.company,
        authorName: notion?.authorName || record.authorName,
        url: notion?.finalUrl || record.finalUrl,
        description,
      }),
    })

    if (notion && settings.notionToken && settings.notionDatabaseId) {
      const schema = await getDatabaseSchema(settings.notionToken, settings.notionDatabaseId)
      await updateNotionWriter(settings.notionToken, notion.pageId, schema, {
        workflow: "Ready",
        subject: written.subject,
        body: written.body,
        company: written.company,
        role: written.role,
      })
    }

    const saved = await saveRecord({
      ...record,
      title: written.role || record.title,
      company: written.company || record.company,
      draft: {
        to: notion?.draftTo?.trim() || record.draft.to,
        subject: written.subject,
        body: written.body,
      },
      draftEdited: false,
      updatedAt: new Date().toISOString(),
    })
    const refreshed = await loadNotionForRecord(saved)
    return Response.json({ record: applyNotionDraft(saved, refreshed), notion: refreshed })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The draft could not be rewritten."
    return Response.json({ error: message }, { status: 422 })
  }
}
