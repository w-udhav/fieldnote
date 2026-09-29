import { findBriefByPageId, findBriefByRecordId, pagePlainText } from "./notion"
import { loadSettings } from "./settings"
import { getRecord, saveRecord } from "./store"
import type { BriefKind, BriefRecord, NotionBrief } from "./types"

function kindOf(value: string | null): BriefKind {
  if (value === "job" || value === "post" || value === "page") return value
  return "page"
}

export function recordFromNotion(notion: NotionBrief, description = ""): BriefRecord {
  const id = notion.recordId?.trim() || notion.pageId
  const when = notion.updatedAt || new Date().toISOString()
  const sent = notion.workflow?.toLowerCase() === "sent" || notion.status?.toLowerCase() === "sent"
  const email = notion.draftTo?.trim() ?? ""
  return {
    id,
    createdAt: when,
    updatedAt: when,
    status: sent ? "sent" : "filed",
    sentMessageId: notion.sentMessageId,
    sourceUrl: notion.finalUrl ?? "",
    finalUrl: notion.finalUrl ?? "",
    kind: kindOf(notion.kind),
    title: notion.title || "Untitled",
    company: notion.company,
    location: "",
    employmentType: "",
    authorName: notion.authorName,
    authorUrl: "",
    publishedAt: notion.publishedAt,
    description,
    emails: email ? [email] : [],
    phones: [],
    hashtags: [],
    categories: notion.categories ?? [],
    draft: {
      to: email,
      subject: notion.aiSubject ?? "",
      body: notion.aiBody ?? "",
    },
    draftEdited: false,
    sentAt: sent ? when : null,
    sendError: null,
    destinations: {
      local: { status: "filed" },
      notion: {
        status: "filed",
        pageId: notion.pageId,
        url: notion.notionUrl ?? undefined,
      },
      sheets: { status: "skipped" },
    },
  }
}

export async function ensureLocalRecord(id: string) {
  const existing = await getRecord(id)
  if (existing) return existing

  const settings = await loadSettings()
  if (!settings.notionToken || !settings.notionDatabaseId) return null

  let notion: NotionBrief | null = null
  try {
    notion = await findBriefByRecordId(settings.notionToken, settings.notionDatabaseId, id)
  } catch {
    notion = null
  }
  if (!notion) {
    notion = await findBriefByPageId(settings.notionToken, settings.notionDatabaseId, id)
  }
  if (!notion) return null

  const canonicalId = notion.recordId?.trim() || notion.pageId
  if (canonicalId !== id) {
    const canonical = await getRecord(canonicalId)
    if (canonical) return canonical
  }

  let description = ""
  try {
    description = await pagePlainText(settings.notionToken, notion.pageId)
  } catch {
    description = ""
  }
  return saveRecord(recordFromNotion(notion, description))
}
