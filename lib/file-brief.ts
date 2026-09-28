import { randomUUID } from "node:crypto"
import { buildDraft } from "./draft"
import { fileNotion } from "./notion"
import { pushSheet } from "./sheets"
import { loadSettings } from "./settings"
import { findOpenByUrl, saveRecord } from "./store"
import type { BriefRecord, DestinationResult, ParsedBrief } from "./types"

function failed(error: unknown): DestinationResult {
  return {
    status: "failed",
    detail: error instanceof Error ? error.message : "Could not file this destination.",
  }
}

async function syncDestinations(record: BriefRecord): Promise<BriefRecord> {
  const settings = await loadSettings()
  let notion: DestinationResult = { status: "skipped", detail: "Notion is not connected." }
  let sheets: DestinationResult = { status: "skipped", detail: "Google Sheets is not connected." }

  if (settings.notionToken && settings.notionDatabaseId) {
    try {
      const filed = await fileNotion(settings.notionToken, settings.notionDatabaseId, record)
      notion = { status: "filed", pageId: filed.pageId, url: filed.url }
    } catch (error) {
      notion = { ...failed(error), pageId: record.destinations.notion.pageId }
    }
  }

  if (settings.sheetsWebhookUrl) {
    try {
      await pushSheet(settings.sheetsWebhookUrl, record)
      sheets = { status: "filed" }
    } catch (error) {
      sheets = failed(error)
    }
  }

  return {
    ...record,
    destinations: {
      local: { status: "filed" },
      notion,
      sheets,
    },
  }
}

export async function fileParsedBrief(brief: ParsedBrief) {
  const settings = await loadSettings()
  const existing = await findOpenByUrl(brief.finalUrl)
  const now = new Date().toISOString()
  const draft =
    existing?.draftEdited && existing.draft
      ? existing.draft
      : buildDraft(brief, { name: settings.senderName, email: settings.senderEmail })

  const base: BriefRecord = {
    id: existing?.id ?? randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status: existing?.status === "send_failed" ? "send_failed" : "filed",
    ...brief,
    draft,
    draftEdited: existing?.draftEdited ?? false,
    sentAt: existing?.sentAt ?? null,
    sendError: existing?.sendError ?? null,
    destinations: existing?.destinations ?? {
      local: { status: "filed" },
      notion: { status: "skipped" },
      sheets: { status: "skipped" },
    },
  }

  const synced = await syncDestinations(base)
  return {
    record: await saveRecord(synced),
    reused: Boolean(existing),
  }
}

export async function syncRecord(record: BriefRecord) {
  const synced = await syncDestinations(record)
  return saveRecord({ ...synced, updatedAt: new Date().toISOString() })
}
