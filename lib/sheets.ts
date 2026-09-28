import { assertSheetsWebhook } from "./settings"
import type { BriefRecord } from "./types"

export function sheetPayload(record: BriefRecord) {
  return {
    recordId: record.id,
    filedAt: record.createdAt,
    status: record.status,
    kind: record.kind,
    title: record.title,
    company: record.company,
    location: record.location,
    employmentType: record.employmentType,
    author: record.authorName,
    authorUrl: record.authorUrl,
    emails: record.emails.join(", "),
    phones: record.phones.join(", "),
    url: record.finalUrl,
    submittedUrl: record.sourceUrl,
    publishedAt: record.publishedAt ?? "",
    description: record.description.slice(0, 4000),
    draftTo: record.draft.to,
    draftSubject: record.draft.subject,
    sentAt: record.sentAt ?? "",
  }
}

export async function pushSheet(webhookUrl: string, record: BriefRecord, probe = false) {
  assertSheetsWebhook(webhookUrl)
  const body = probe ? { probe: true } : sheetPayload(record)
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text.slice(0, 280) || `Google Sheet returned ${response.status}.`)
  }
  return true
}
