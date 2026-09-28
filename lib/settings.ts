import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { PublicSettings, Settings } from "./types"

const FILE = path.join(process.cwd(), "data", "settings.json")

function fromEnv(): Settings {
  const port = Number(process.env.SMTP_PORT || 587)
  return {
    senderName: process.env.SENDER_NAME || "",
    senderEmail: process.env.SMTP_FROM || process.env.SENDER_EMAIL || "",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number.isFinite(port) ? port : 587,
    smtpSecure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    notionToken: process.env.NOTION_TOKEN || "",
    notionDatabaseId: process.env.NOTION_DATABASE_ID || "",
    sheetsWebhookUrl: process.env.SHEETS_WEBHOOK_URL || "",
  }
}

function overlay(base: Settings, patch: Partial<Settings>): Settings {
  const next = { ...base }
  for (const [key, value] of Object.entries(patch) as [keyof Settings, Settings[keyof Settings]][]) {
    if (value === undefined || value === null) continue
    if (typeof value === "string" && value.trim() === "" && (key === "smtpPass" || key === "notionToken")) {
      continue
    }
    if (key === "smtpPort") {
      const port = Number(value)
      if (Number.isFinite(port) && port > 0) next.smtpPort = port
      continue
    }
    if (key === "smtpSecure") {
      next.smtpSecure = Boolean(value)
      continue
    }
    if (typeof value === "string") {
      next[key] = value.trim() as never
    }
  }
  return next
}

export async function loadSettings(): Promise<Settings> {
  const env = fromEnv()
  try {
    const raw = await readFile(FILE, "utf8")
    const saved = JSON.parse(raw) as Partial<Settings>
    return overlay(env, saved)
  } catch {
    return env
  }
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await loadSettings()
  const next = overlay(current, patch)
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(next, null, 2))
  return next
}

export function toPublic(settings: Settings): PublicSettings {
  return {
    senderName: settings.senderName,
    senderEmail: settings.senderEmail,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser,
    smtpConfigured: Boolean(settings.smtpHost && settings.senderEmail),
    notionDatabaseId: settings.notionDatabaseId,
    notionConfigured: Boolean(settings.notionToken && settings.notionDatabaseId),
    sheetsWebhookUrl: settings.sheetsWebhookUrl,
    sheetsConfigured: Boolean(settings.sheetsWebhookUrl),
    lockRequired: Boolean(process.env.FIELDNOTE_KEY) || false,
  }
}

export function assertSheetsWebhook(raw: string) {
  if (!raw.trim()) return
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error("The Google Sheet webhook is not a valid URL.")
  }
  if (url.protocol !== "https:") {
    throw new Error("The Google Sheet webhook must use https.")
  }
  const host = url.hostname.toLowerCase()
  const allowed =
    host === "script.google.com" || host.endsWith(".googleusercontent.com")
  if (!allowed) {
    throw new Error("Use the Google Apps Script web app URL from script.google.com.")
  }
}
