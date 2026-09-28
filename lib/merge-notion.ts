import { draftFromNotionBrief, findBriefByRecordId } from "./notion"
import { loadSettings } from "./settings"
import type { BriefRecord, NotionBrief } from "./types"

export async function loadNotionForRecord(record: BriefRecord): Promise<NotionBrief | null> {
  const settings = await loadSettings()
  if (!settings.notionToken || !settings.notionDatabaseId) return null
  try {
    return await findBriefByRecordId(settings.notionToken, settings.notionDatabaseId, record.id)
  } catch {
    return null
  }
}

export function applyNotionDraft(record: BriefRecord, notion: NotionBrief | null): BriefRecord {
  if (!notion || record.draftEdited) return record
  const draft = draftFromNotionBrief(notion, record.draft)
  const same =
    draft.to === record.draft.to &&
    draft.subject === record.draft.subject &&
    draft.body === record.draft.body
  if (same) return record
  return { ...record, draft }
}
