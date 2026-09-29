import { readFile } from "node:fs/promises"
import path from "node:path"
import { intakeLinkedInUrl } from "../lib/intake"
import { readTelegramOffset, writeTelegramOffset } from "../lib/telegram-state"
import {
  handleTelegramUpdate,
  parseTelegramAllowlist,
  type TelegramUpdate,
} from "../lib/telegram"

async function loadEnvFile() {
  try {
    const raw = await readFile(path.join(process.cwd(), ".env"), "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // Environment variables may already be provided by the process manager.
  }
}

class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

async function telegramCall<T>(
  token: string,
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(65_000),
  })
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    result?: T
    description?: string
  }
  if (!response.ok || !data.ok) {
    throw new TelegramApiError(
      data.description || `Telegram ${method} returned ${response.status}.`,
      response.status
    )
  }
  return data.result as T
}

async function main() {
  await loadEnvFile()
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? ""
  const allowedIds = parseTelegramAllowlist(process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
  if (!token) throw new Error("Set TELEGRAM_BOT_TOKEN to start Telegram intake.")
  if (!allowedIds.size) {
    throw new Error("Set TELEGRAM_ALLOWED_CHAT_IDS to one or more numeric Telegram IDs.")
  }

  await telegramCall(token, "deleteWebhook", { drop_pending_updates: false })
  const bot = await telegramCall<{ username?: string }>(token, "getMe", {})
  let offset = await readTelegramOffset()
  console.log(`Telegram intake started as @${bot.username || "bot"} (offset ${offset}).`)

  for (;;) {
    let updates: TelegramUpdate[]
    try {
      updates = await telegramCall<TelegramUpdate[]>(token, "getUpdates", {
        offset,
        timeout: 50,
        allowed_updates: ["message", "channel_post"],
      })
    } catch (error) {
      if (error instanceof TelegramApiError && (error.status === 401 || error.status === 403)) {
        throw error
      }
      console.error(error instanceof Error ? error.message : error)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      continue
    }

    for (const update of updates) {
      try {
        await handleTelegramUpdate(update, {
          allowedIds,
          fileUrl: intakeLinkedInUrl,
          reply: (chatId, text) =>
            telegramCall(token, "sendMessage", {
              chat_id: chatId,
              text: text.slice(0, 4000),
              disable_web_page_preview: true,
            }),
          onUnauthorized: (chatId, userId) => {
            console.warn(
              `Ignored Telegram update from chat ${chatId}${userId ? `, user ${userId}` : ""}.`
            )
          },
        })
      } catch (error) {
        console.error(`Update ${update.update_id}:`, error instanceof Error ? error.message : error)
      } finally {
        offset = Math.max(offset, update.update_id + 1)
        await writeTelegramOffset(offset)
      }
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
