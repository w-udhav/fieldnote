import type { BriefRecord, EmailDraft, NotionBrief } from "./types"

const NOTION_VERSION = "2022-06-28"

type NotionProperty = {
  name: string
  type: string
  select?: { options?: { name: string }[] }
  status?: { options?: { name: string }[] }
}

type NotionPage = {
  id: string
  url?: string
  created_time?: string
  last_edited_time?: string
  properties: Record<string, unknown>
}

export function resolveDatabaseId(raw: string) {
  const compact = raw.replace(/-/g, "")
  const match = compact.match(/[0-9a-f]{32}/i)
  return match?.[0] ?? raw.trim()
}

async function notion(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20000),
  })
  const text = await response.text()
  const json = text ? (JSON.parse(text) as { message?: string; url?: string; id?: string }) : {}
  if (!response.ok) {
    throw new Error(json.message || `Notion returned ${response.status}.`)
  }
  return json as Record<string, unknown>
}

function propertiesOf(schema: Record<string, unknown>): NotionProperty[] {
  const properties = schema.properties
  if (!properties || typeof properties !== "object") return []
  return Object.entries(properties as Record<string, { type?: string }>).map(([name, def]) => ({
    name,
    type: def.type ?? "",
    ...(def as object),
  }))
}

export function findProperty(properties: NotionProperty[], names: string[], type?: string) {
  const wanted = new Set(names.map((name) => name.toLowerCase()))
  const matches = properties.filter((property) => wanted.has(property.name.toLowerCase()))
  if (type) return matches.find((property) => property.type === type) ?? null
  return matches[0] ?? null
}

function rich(content: string) {
  return { rich_text: [{ type: "text", text: { content: content.slice(0, 1900) } }] }
}

function selectValue(property: NotionProperty, label: string) {
  const options = property.select?.options ?? property.status?.options ?? []
  const match = options.find((option) => option.name.toLowerCase() === label.toLowerCase())
  if (!match) return null
  if (property.type === "status") return { status: { name: match.name } }
  if (property.type === "select") return { select: { name: match.name } }
  return null
}

function plainFromRich(value: unknown) {
  if (!value || typeof value !== "object") return ""
  const rich = (value as { rich_text?: { plain_text?: string }[] }).rich_text
  if (!Array.isArray(rich)) return ""
  return rich.map((part) => part.plain_text ?? "").join("")
}

function readPropertyValue(raw: unknown, type: string): string {
  if (!raw || typeof raw !== "object") return ""
  const value = raw as Record<string, unknown>
  if (type === "title") {
    const title = (value as { title?: { plain_text?: string }[] }).title
    if (Array.isArray(title)) return title.map((part) => part.plain_text ?? "").join("")
    return plainFromRich(value)
  }
  if (type === "rich_text") return plainFromRich(value)
  if (type === "url") return typeof value.url === "string" ? value.url : ""
  if (type === "email") return typeof value.email === "string" ? value.email : ""
  if (type === "phone_number") return typeof value.phone_number === "string" ? value.phone_number : ""
  if (type === "select") {
    const select = value.select as { name?: string } | null
    return select?.name ?? ""
  }
  if (type === "status") {
    const status = value.status as { name?: string } | null
    return status?.name ?? ""
  }
  if (type === "date") {
    const date = value.date as { start?: string } | null
    return date?.start ?? ""
  }
  if (type === "checkbox") return value.checkbox === true ? "true" : ""
  return ""
}

function readByNames(page: NotionPage, properties: NotionProperty[], names: string[], type?: string) {
  const property = findProperty(properties, names, type)
  if (!property) return ""
  const raw = page.properties[property.name]
  return readPropertyValue(raw, property.type)
}

export function notionPageToBrief(page: NotionPage, schema: Record<string, unknown>): NotionBrief {
  const properties = propertiesOf(schema)
  const titleProp = properties.find((property) => property.type === "title")
  const title = titleProp ? readPropertyValue(page.properties[titleProp.name], "title") : ""

  return {
    pageId: page.id,
    recordId: readByNames(page, properties, ["record id", "recordid"]) || null,
    notionUrl: page.url ?? null,
    title,
    company: readByNames(page, properties, ["company", "organization", "org"]),
    authorName: readByNames(page, properties, ["author", "poster", "contact name"]),
    publishedAt:
      readByNames(page, properties, ["published", "posted", "date"]) ||
      null,
    workflow: readByNames(page, properties, ["workflow"], "status") ||
      readByNames(page, properties, ["workflow"], "select") ||
      null,
    status:
      readByNames(page, properties, ["status"], "status") ||
      readByNames(page, properties, ["status"], "select") ||
      null,
    kind: readByNames(page, properties, ["kind", "type"]),
    finalUrl: readByNames(page, properties, ["url", "link", "source", "linkedin"], "url"),
    draftTo: readByNames(page, properties, ["draft to"], "email") ||
      readByNames(page, properties, ["draft to"]),
    aiSubject: readByNames(page, properties, ["ai subject"]),
    aiBody: readByNames(page, properties, ["ai body"]),
    sentMessageId: readByNames(page, properties, ["sent message id"]),
    lastReplyAt: readByNames(page, properties, ["last reply at"]) || null,
    lastReplySnippet: readByNames(page, properties, ["last reply snippet"]),
    hasUnreadReply: readByNames(page, properties, ["has unread reply"]) === "true",
    updatedAt: page.last_edited_time ?? page.created_time ?? new Date().toISOString(),
  }
}

export async function getDatabaseSchema(token: string, rawDatabaseId: string) {
  return notion(token, `/databases/${resolveDatabaseId(rawDatabaseId)}`)
}

export async function queryBriefs(token: string, rawDatabaseId: string) {
  const id = resolveDatabaseId(rawDatabaseId)
  const schema = await getDatabaseSchema(token, rawDatabaseId)
  const briefs: NotionBrief[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      page_size: 100,
    }
    if (cursor) body.start_cursor = cursor

    const result = (await notion(token, `/databases/${id}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    })) as {
      results?: NotionPage[]
      has_more?: boolean
      next_cursor?: string | null
    }

    for (const page of result.results ?? []) {
      briefs.push(notionPageToBrief(page, schema))
    }
    cursor = result.has_more && result.next_cursor ? result.next_cursor : undefined
  } while (cursor)

  return { schema, briefs }
}

export async function getNotionPage(token: string, pageId: string) {
  return (await notion(token, `/pages/${pageId}`)) as NotionPage
}

export async function findBriefByRecordId(token: string, rawDatabaseId: string, recordId: string) {
  const id = resolveDatabaseId(rawDatabaseId)
  const schema = await getDatabaseSchema(token, rawDatabaseId)
  const properties = propertiesOf(schema)
  const recordProp = findProperty(properties, ["record id", "recordid"])
  if (!recordProp) return null

  const filter =
    recordProp.type === "rich_text"
      ? { property: recordProp.name, rich_text: { equals: recordId.slice(0, 2000) } }
      : { property: recordProp.name, title: { equals: recordId.slice(0, 2000) } }

  const result = (await notion(token, `/databases/${id}/query`, {
    method: "POST",
    body: JSON.stringify({ filter, page_size: 1 }),
  })) as { results?: NotionPage[] }

  const page = result.results?.[0]
  if (!page) return null
  return notionPageToBrief(page, schema)
}

export function draftFromNotionBrief(notion: NotionBrief, fallback: EmailDraft): EmailDraft {
  const ready = notion.workflow?.toLowerCase() === "ready"
  if (ready && notion.aiSubject && notion.aiBody) {
    return {
      to: notion.draftTo?.trim() || fallback.to,
      subject: notion.aiSubject,
      body: notion.aiBody,
    }
  }
  return {
    to: notion.draftTo?.trim() || fallback.to,
    subject: fallback.subject,
    body: fallback.body,
  }
}

export function briefProperties(
  schema: Record<string, unknown>,
  record: Pick<
    BriefRecord,
    | "id"
    | "title"
    | "company"
    | "location"
    | "kind"
    | "authorName"
    | "emails"
    | "phones"
    | "finalUrl"
    | "publishedAt"
    | "status"
    | "employmentType"
    | "draft"
  >,
  options?: { preserveWorkflow?: boolean }
) {
  const properties = propertiesOf(schema)
  const payload: Record<string, unknown> = {}
  const title = properties.find((property) => property.type === "title")
  if (title) {
    payload[title.name] = {
      title: [{ type: "text", text: { content: (record.title || "LinkedIn brief").slice(0, 1900) } }],
    }
  }

  const assign = (property: NotionProperty | null, value: string) => {
    if (!property || !value) return
    if (property.type === "rich_text") payload[property.name] = rich(value)
    if (property.type === "url") payload[property.name] = { url: value }
    if (property.type === "email") payload[property.name] = { email: value }
    if (property.type === "phone_number") payload[property.name] = { phone_number: value }
    if (property.type === "date") {
      const date = value.slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) payload[property.name] = { date: { start: date } }
    }
  }

  assign(findProperty(properties, ["record id", "recordid"]), record.id)
  assign(
    findProperty(properties, ["email", "contact email", "contact"], "email") ??
      findProperty(properties, ["email", "contact email"]),
    record.emails[0] ?? ""
  )
  assign(
    findProperty(properties, ["draft to"], "email") ?? findProperty(properties, ["draft to"]),
    record.draft.to.trim() || (record.emails[0] ?? "")
  )
  assign(findProperty(properties, ["phone", "phone number"], "phone_number") ?? findProperty(properties, ["phone", "phone number"]), record.phones[0] ?? "")
  assign(findProperty(properties, ["url", "link", "source", "linkedin"]), record.finalUrl)
  assign(findProperty(properties, ["company", "organization", "org"]), record.company)
  assign(findProperty(properties, ["location"]), record.location)
  assign(findProperty(properties, ["author", "poster", "contact name"]), record.authorName)
  assign(findProperty(properties, ["kind", "type"]), record.kind)
  assign(findProperty(properties, ["employment type", "employment"]), record.employmentType)
  assign(findProperty(properties, ["published", "posted", "date"]), record.publishedAt ?? "")

  const statusProp =
    findProperty(properties, ["status"], "status") ?? findProperty(properties, ["status"], "select")
  if (statusProp) {
    const label = record.status === "sent" ? "Sent" : "Filed"
    const value = selectValue(statusProp, label)
    if (value) payload[statusProp.name] = value
  }

  const workflowProp =
    findProperty(properties, ["workflow"], "status") ?? findProperty(properties, ["workflow"], "select")
  if (workflowProp) {
    if (record.status === "sent") {
      const sent = selectValue(workflowProp, "Sent")
      if (sent) payload[workflowProp.name] = sent
    } else if (!options?.preserveWorkflow) {
      const queued = selectValue(workflowProp, "Queued")
      if (queued) payload[workflowProp.name] = queued
    }
  }

  return payload
}

export async function updateNotionMailMeta(
  token: string,
  pageId: string,
  schema: Record<string, unknown>,
  meta: {
    status: BriefRecord["status"]
    sentAt: string | null
    sentMessageId: string
    draft: EmailDraft
  }
) {
  const properties = propertiesOf(schema)
  const payload: Record<string, unknown> = {}

  const statusProp =
    findProperty(properties, ["status"], "status") ?? findProperty(properties, ["status"], "select")
  if (statusProp && meta.status === "sent") {
    const value = selectValue(statusProp, "Sent")
    if (value) payload[statusProp.name] = value
  }

  const workflowProp =
    findProperty(properties, ["workflow"], "status") ?? findProperty(properties, ["workflow"], "select")
  if (workflowProp && meta.status === "sent") {
    const value = selectValue(workflowProp, "Sent")
    if (value) payload[workflowProp.name] = value
  }

  const assign = (property: NotionProperty | null, value: string) => {
    if (!property || !value) return
    if (property.type === "rich_text") payload[property.name] = rich(value)
    if (property.type === "email") payload[property.name] = { email: value }
  }

  assign(findProperty(properties, ["sent message id"]), meta.sentMessageId)
  assign(
    findProperty(properties, ["draft to"], "email") ?? findProperty(properties, ["draft to"]),
    meta.draft.to
  )

  if (Object.keys(payload).length === 0) return
  await notion(token, `/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: payload }),
  })
}

export async function updateNotionReplyMeta(
  token: string,
  pageId: string,
  schema: Record<string, unknown>,
  meta: {
    lastReplyAt: string
    lastReplySnippet: string
    hasUnreadReply: boolean
  }
) {
  const properties = propertiesOf(schema)
  const payload: Record<string, unknown> = {}

  const snippetProp = findProperty(properties, ["last reply snippet"])
  if (snippetProp?.type === "rich_text") {
    payload[snippetProp.name] = rich(meta.lastReplySnippet.slice(0, 1900))
  }

  const dateProp = findProperty(properties, ["last reply at"], "date")
  if (dateProp) {
    const date = meta.lastReplyAt.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      payload[dateProp.name] = { date: { start: date } }
    }
  }

  const unreadProp = findProperty(properties, ["has unread reply"], "checkbox")
  if (unreadProp) {
    payload[unreadProp.name] = { checkbox: meta.hasUnreadReply }
  }

  if (Object.keys(payload).length === 0) return
  await notion(token, `/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: payload }),
  })
}

export async function updateNotionWriter(
  token: string,
  pageId: string,
  schema: Record<string, unknown>,
  meta: { workflow: string; subject?: string; body?: string; company?: string; role?: string }
) {
  const properties = propertiesOf(schema)
  const payload: Record<string, unknown> = {}
  const workflowProp =
    findProperty(properties, ["workflow"], "status") ?? findProperty(properties, ["workflow"], "select")
  if (workflowProp) {
    const value = selectValue(workflowProp, meta.workflow)
    if (value) payload[workflowProp.name] = value
  }
  const subjectProp = findProperty(properties, ["ai subject"])
  if (meta.subject) {
    if (subjectProp?.type !== "rich_text") {
      throw new Error("Add an AI Subject rich text property in Notion.")
    }
    payload[subjectProp.name] = rich(meta.subject)
  }
  const bodyProp = findProperty(properties, ["ai body"])
  if (meta.body) {
    if (bodyProp?.type !== "rich_text") {
      throw new Error("Add an AI Body rich text property in Notion.")
    }
    payload[bodyProp.name] = rich(meta.body)
  }
  const role = meta.role?.trim()
  if (role) {
    const title = properties.find((property) => property.type === "title")
    if (title) {
      payload[title.name] = {
        title: [{ type: "text", text: { content: role.slice(0, 1900) } }],
      }
    }
  }
  const company = meta.company?.trim()
  if (company) {
    const companyProp = findProperty(properties, ["company", "organization", "org"])
    if (companyProp?.type === "rich_text") payload[companyProp.name] = rich(company)
    if (companyProp?.type === "title") {
      payload[companyProp.name] = {
        title: [{ type: "text", text: { content: company.slice(0, 1900) } }],
      }
    }
  }
  if (workflowProp && !payload[workflowProp.name]) {
    throw new Error(`Add a Workflow option named ${meta.workflow}.`)
  }
  if (!workflowProp) {
    throw new Error("Add a Workflow select property in Notion.")
  }
  await notion(token, `/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: payload }),
  })
}

function plainBlocks(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const block = value as {
    type?: string
    paragraph?: { rich_text?: { plain_text?: string }[] }
    [key: string]: unknown
  }
  const typed = block.type ? (block[block.type] as { rich_text?: { plain_text?: string }[] } | undefined) : undefined
  const rich = typed?.rich_text ?? block.paragraph?.rich_text
  if (!Array.isArray(rich)) return ""
  return rich.map((part) => part.plain_text ?? "").join("")
}

export async function pagePlainText(token: string, pageId: string) {
  const chunks: string[] = []
  let cursor: string | undefined
  do {
    const query = cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : ""
    const result = (await notion(token, `/blocks/${pageId}/children${query}`)) as {
      results?: unknown[]
      has_more?: boolean
      next_cursor?: string | null
    }
    for (const block of result.results ?? []) {
      const text = plainBlocks(block).trim()
      if (text) chunks.push(text)
    }
    cursor = result.has_more && result.next_cursor ? result.next_cursor : undefined
  } while (cursor)
  const joined = chunks.join("\n\n")
  const marker = joined.lastIndexOf("Description\n")
  const description = marker >= 0 ? joined.slice(marker + "Description\n".length).trim() : joined
  return description.slice(0, 6000)
}

function blocks(record: BriefRecord) {
  const sections = [
    `Source\n${record.finalUrl}`,
    `Contact\n${[...record.emails, ...record.phones].join("\n") || "No email or phone was on the public page."}`,
    record.company ? `Company\n${record.company}` : "",
    record.location ? `Location\n${record.location}` : "",
    `Draft subject\n${record.draft.subject}`,
    `Draft\n${record.draft.body}`,
    `Description\n${record.description}`,
  ].filter(Boolean)

  const children = []
  for (const section of sections) {
    for (let index = 0; index < section.length; index += 1800) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: section.slice(index, index + 1800) } }],
        },
      })
    }
  }
  return children.slice(0, 90)
}

const select = (options: string[]) => ({
  select: { options: options.map((name) => ({ name })) },
})

export const FIELDNOTE_NOTION_COLUMNS: Record<string, unknown> = {
  Company: { rich_text: {} },
  Location: { rich_text: {} },
  Author: { rich_text: {} },
  URL: { url: {} },
  Email: { email: {} },
  Phone: { phone_number: {} },
  Kind: { rich_text: {} },
  "Employment Type": { rich_text: {} },
  Published: { date: {} },
  Status: select(["Filed", "Sent"]),
  "Record ID": { rich_text: {} },
  Workflow: select(["Queued", "AI pending", "Ready", "AI failed", "Sent"]),
  "AI Subject": { rich_text: {} },
  "AI Body": { rich_text: {} },
  "Draft To": { email: {} },
  "Sent Message ID": { rich_text: {} },
  "Last Reply At": { date: {} },
  "Last Reply Snippet": { rich_text: {} },
  "Has Unread Reply": { checkbox: {} },
}

export function notionSchemaReset(existing: { name: string; type: string }[]) {
  const title = existing.find((property) => property.type === "title")
  const remove: Record<string, null> = {}
  for (const property of existing) {
    if (property.type === "title") continue
    remove[property.name] = null
  }
  const create = { ...FIELDNOTE_NOTION_COLUMNS }
  return {
    titleName: title?.name ?? null,
    renameTitle: Boolean(title && title.name !== "Role"),
    remove,
    create,
  }
}

export async function resetNotionSchema(token: string, rawDatabaseId: string) {
  const id = resolveDatabaseId(rawDatabaseId)
  const schema = await getDatabaseSchema(token, rawDatabaseId)
  const plan = notionSchemaReset(propertiesOf(schema))
  if (!plan.titleName) throw new Error("This Notion database has no title column.")

  if (Object.keys(plan.remove).length > 0) {
    await notion(token, `/databases/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: plan.remove }),
    })
  }

  const properties: Record<string, unknown> = { ...plan.create }
  if (plan.renameTitle) properties[plan.titleName] = { name: "Role" }
  await notion(token, `/databases/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  })
  return { columns: Object.keys(plan.create).length }
}

export async function checkNotion(token: string, rawDatabaseId: string) {
  const schema = await getDatabaseSchema(token, rawDatabaseId)
  const title = Array.isArray(schema.title)
    ? schema.title
        .map((part) =>
          part && typeof part === "object" && "plain_text" in part
            ? String((part as { plain_text?: string }).plain_text ?? "")
            : ""
        )
        .join("")
    : "Notion database"
  return { title: title || "Notion database" }
}

export async function fileNotion(token: string, rawDatabaseId: string, record: BriefRecord) {
  const id = resolveDatabaseId(rawDatabaseId)
  const schema = await getDatabaseSchema(token, rawDatabaseId)
  const preserveWorkflow = Boolean(record.destinations.notion.pageId)
  const properties = briefProperties(schema, record, { preserveWorkflow })
  if (record.destinations.notion.pageId) {
    await notion(token, `/pages/${record.destinations.notion.pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    })
    return {
      pageId: record.destinations.notion.pageId,
      url: record.destinations.notion.url,
    }
  }
  const created = await notion(token, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: id },
      properties,
      children: blocks(record),
    }),
  })
  return {
    pageId: typeof created.id === "string" ? created.id : undefined,
    url: typeof created.url === "string" ? created.url : undefined,
  }
}
