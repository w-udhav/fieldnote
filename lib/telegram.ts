export type TelegramEntity = {
  type: string
  url?: string
}

export type TelegramMessage = {
  chat: { id: number }
  from?: { id: number }
  text?: string
  caption?: string
  entities?: TelegramEntity[]
  caption_entities?: TelegramEntity[]
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  channel_post?: TelegramMessage
}

export function parseTelegramAllowlist(raw: string) {
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^-?\d+$/.test(value))
  )
}

function cleanUrl(value: string) {
  return value.replace(/[)\]}>.,;!?]+$/g, "")
}

export function extractTelegramLinkedInUrls(message: TelegramMessage) {
  const text = [message.text, message.caption].filter(Boolean).join("\n")
  const plain =
    text.match(
      /https?:\/\/(?:(?:[\w-]+\.)?linkedin\.com\/[^\s<>"']+|lnkd\.in\/[^\s<>"']+)/gi
    ) ?? []
  const entityUrls = [...(message.entities ?? []), ...(message.caption_entities ?? [])]
    .filter((entity) => entity.type === "text_link" && entity.url)
    .map((entity) => entity.url ?? "")
    .filter((url) => /https?:\/\/(?:(?:[\w-]+\.)?linkedin\.com\/|lnkd\.in\/)/i.test(url))
  return [...new Set([...plain, ...entityUrls].map(cleanUrl))].slice(0, 20)
}

export function telegramMessage(update: TelegramUpdate) {
  return update.message ?? update.channel_post ?? null
}

export function telegramUpdateAllowed(message: TelegramMessage, allowedIds: Set<string>) {
  return (
    allowedIds.has(String(message.chat.id)) ||
    (message.from ? allowedIds.has(String(message.from.id)) : false)
  )
}

type FiledResult = {
  record: { id: string; title: string }
  reused: boolean
}

export type TelegramUpdateResult =
  | "ignored"
  | "unauthorized"
  | "no_links"
  | "processed"

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  options: {
    allowedIds: Set<string>
    fileUrl: (url: string) => Promise<FiledResult>
    reply: (chatId: number, text: string) => Promise<void>
    onUnauthorized?: (chatId: number, userId?: number) => void
  }
): Promise<TelegramUpdateResult> {
  const message = telegramMessage(update)
  if (!message) return "ignored"
  if (!telegramUpdateAllowed(message, options.allowedIds)) {
    options.onUnauthorized?.(message.chat.id, message.from?.id)
    return "unauthorized"
  }

  const urls = extractTelegramLinkedInUrls(message)
  if (!urls.length) {
    await options.reply(
      message.chat.id,
      "Send or forward a message containing a public LinkedIn job or post link."
    )
    return "no_links"
  }

  const lines: string[] = []
  for (const url of urls) {
    try {
      const filed = await options.fileUrl(url)
      const id = filed.record.id.replace(/-/g, "").slice(0, 8).toUpperCase()
      lines.push(
        `${filed.reused ? "Updated" : "Filed"}: ${filed.record.title || "Untitled"} (Job ID ${id})`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not file this link."
      lines.push(`Failed: ${message}`)
    }
  }
  await options.reply(message.chat.id, lines.join("\n"))
  return "processed"
}
