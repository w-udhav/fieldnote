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
  if (!notion) return record
  const company = notion.company.trim()
  const withCompany = company && company !== record.company ? { ...record, company } : record
  if (withCompany.draftEdited) return withCompany
  const draft = draftFromNotionBrief(notion, withCompany.draft)
  const same =
    draft.to === withCompany.draft.to &&
    draft.subject === withCompany.draft.subject &&
    draft.body === withCompany.draft.body
  if (same) return withCompany
  return { ...withCompany, draft }
}
