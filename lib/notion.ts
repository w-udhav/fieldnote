import type { BriefRecord } from "./types"

const NOTION_VERSION = "2022-06-28"

type NotionProperty = {
  name: string
  type: string
  select?: { options?: { name: string }[] }
  status?: { options?: { name: string }[] }
}

function databaseId(raw: string) {
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
    signal: AbortSignal.timeout(15000),
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

function findProperty(properties: NotionProperty[], names: string[], type?: string) {
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

export function briefProperties(
  schema: Record<string, unknown>,
  record: Pick<
    BriefRecord,
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
  >
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

  assign(findProperty(properties, ["email", "contact email", "contact"], "email") ?? findProperty(properties, ["email", "contact email"]), record.emails[0] ?? "")
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

  return payload
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

export async function checkNotion(token: string, rawDatabaseId: string) {
  const schema = await notion(token, `/databases/${databaseId(rawDatabaseId)}`)
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
  const id = databaseId(rawDatabaseId)
  const schema = await notion(token, `/databases/${id}`)
  const properties = briefProperties(schema, record)
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
