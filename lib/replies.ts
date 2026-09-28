import { ImapFlow } from "imapflow"
import {
  getDatabaseSchema,
  queryBriefs,
  updateNotionReplyMeta,
} from "./notion"
import { loadSettings } from "./settings"
import type { NotionBrief } from "./types"

function normalizeMessageId(value: string) {
  return value.replace(/^<|>$/g, "").trim().toLowerCase()
}

function snippetFromSource(source: Buffer) {
  const raw = source.toString("utf8")
  const bodyStart = raw.indexOf("\r\n\r\n")
  const body = bodyStart >= 0 ? raw.slice(bodyStart + 4) : raw
  const flat = body.replace(/\s+/g, " ").trim()
  if (!flat) return "Reply received."
  if (flat.length <= 200) return flat
  return `${flat.slice(0, 199)}…`
}

function headerValue(source: Buffer, name: string) {
  const raw = source.toString("utf8", 0, 12000)
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))
  return match?.[1]?.trim() ?? ""
}

function referencesIds(source: Buffer) {
  const refs = headerValue(source, "References")
  const reply = headerValue(source, "In-Reply-To")
  const combined = [refs, reply].filter(Boolean).join(" ")
  const ids = combined.match(/<[^>]+>/g) ?? []
  return ids.map((id) => normalizeMessageId(id))
}

async function findLatestReply(
  client: ImapFlow,
  brief: NotionBrief
): Promise<{ at: string; snippet: string; unread: boolean } | null> {
  const sentId = brief.sentMessageId?.trim()
  if (!sentId) return null

  const lock = await client.getMailboxLock("INBOX")
  try {
    const needle = normalizeMessageId(sentId)
    const messages: { at: Date; snippet: string; unread: boolean }[] = []

    for await (const message of client.fetch("1:*", {
      envelope: true,
      source: true,
      flags: true,
    })) {
      const source = message.source
      if (!source) continue

      const refs = referencesIds(source)
      const matchesThread = refs.some((ref) => ref.includes(needle) || needle.includes(ref))

      const fromAddresses =
        message.envelope?.from?.map((addr) => addr.address?.toLowerCase() ?? "") ?? []
      const fromReply =
        brief.draftTo && fromAddresses.includes(brief.draftTo.toLowerCase())
      const subject = message.envelope?.subject?.toLowerCase() ?? ""
      const subjectReply = subject.startsWith("re:")

      if (!matchesThread && !(fromReply && subjectReply)) continue

      const atRaw = message.envelope?.date ?? new Date()
      const at = atRaw instanceof Date ? atRaw : new Date(atRaw)
      messages.push({
        at,
        snippet: snippetFromSource(source),
        unread: !message.flags?.has("\\Seen"),
      })
    }

    if (!messages.length) return null
    messages.sort((a, b) => b.at.getTime() - a.at.getTime())
    const latest = messages[0]
    return {
      at: latest.at.toISOString(),
      snippet: latest.snippet,
      unread: latest.unread,
    }
  } finally {
    lock.release()
  }
}

export async function syncReplies(options?: { pageId?: string }) {
  const settings = await loadSettings()
  if (!settings.notionToken || !settings.notionDatabaseId) {
    throw new Error("Connect Notion in Settings before syncing replies.")
  }
  if (!settings.smtpUser || !settings.smtpPass) {
    throw new Error("Add Gmail SMTP credentials in Settings to sync replies.")
  }

  const { briefs } = await queryBriefs(settings.notionToken, settings.notionDatabaseId)
  const targets = briefs.filter((brief) => {
    if (options?.pageId && brief.pageId !== options.pageId) return false
    const sent =
      brief.status?.toLowerCase() === "sent" || brief.workflow?.toLowerCase() === "sent"
    return sent && Boolean(brief.sentMessageId)
  })

  if (!targets.length) return { updated: 0 }

  const schema = await getDatabaseSchema(settings.notionToken, settings.notionDatabaseId)
  const client = new ImapFlow({
    host: settings.imapHost,
    port: settings.imapPort,
    secure: settings.imapSecure,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    logger: false,
  })

  await client.connect()
  let updated = 0
  try {
    for (const brief of targets) {
      const reply = await findLatestReply(client, brief)
      if (!reply) continue
      await updateNotionReplyMeta(settings.notionToken, brief.pageId, schema, {
        lastReplyAt: reply.at,
        lastReplySnippet: reply.snippet,
        hasUnreadReply: reply.unread,
      })
      updated += 1
    }
  } finally {
    await client.logout()
  }

  return { updated }
}
