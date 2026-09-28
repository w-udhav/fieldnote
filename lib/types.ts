export type BriefKind = "job" | "post" | "page"

export type EmailDraft = {
  to: string
  subject: string
  body: string
}

export type DestinationStatus = "skipped" | "filed" | "failed"

export type DestinationResult = {
  status: DestinationStatus
  detail?: string
  url?: string
  pageId?: string
}

export type BriefRecord = {
  id: string
  createdAt: string
  updatedAt: string
  status: "filed" | "sent" | "send_failed"
  sourceUrl: string
  finalUrl: string
  kind: BriefKind
  title: string
  company: string
  location: string
  employmentType: string
  authorName: string
  authorUrl: string
  publishedAt: string | null
  description: string
  emails: string[]
  phones: string[]
  hashtags: string[]
  draft: EmailDraft
  draftEdited: boolean
  sentAt: string | null
  sendError: string | null
  destinations: {
    local: DestinationResult
    notion: DestinationResult
    sheets: DestinationResult
  }
}

export type ParsedBrief = Omit<
  BriefRecord,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "status"
  | "draft"
  | "draftEdited"
  | "sentAt"
  | "sendError"
  | "destinations"
>

export type Settings = {
  senderName: string
  senderEmail: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  notionToken: string
  notionDatabaseId: string
  sheetsWebhookUrl: string
}

export type PublicSettings = {
  senderName: string
  senderEmail: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpConfigured: boolean
  notionDatabaseId: string
  notionConfigured: boolean
  sheetsWebhookUrl: string
  sheetsConfigured: boolean
  lockRequired: boolean
}
