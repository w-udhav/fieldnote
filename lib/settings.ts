import { access } from "node:fs/promises"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { PublicSettings, Settings } from "./types"
import { resolveWriterSystem, writerSystem } from "./writer"

const FILE = path.join(process.cwd(), "data", "settings.json")
const DEFAULT_RESUME = path.join("data", "Udhav_Resume.pdf")

function fromEnv(): Settings {
  const port = Number(process.env.SMTP_PORT || 587)
  const imapPort = Number(process.env.IMAP_PORT || 993)
  return {
    senderName: process.env.SENDER_NAME || "",
    senderEmail: process.env.SMTP_FROM || process.env.SENDER_EMAIL || "",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number.isFinite(port) ? port : 587,
    smtpSecure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    imapHost: process.env.IMAP_HOST || "imap.gmail.com",
    imapPort: Number.isFinite(imapPort) ? imapPort : 993,
    imapSecure: process.env.IMAP_SECURE !== "false",
    resumePath: process.env.RESUME_PATH || DEFAULT_RESUME,
    notionToken: process.env.NOTION_TOKEN || "",
    notionDatabaseId: process.env.NOTION_DATABASE_ID || "",
    notionCompaniesDatabaseId: process.env.NOTION_COMPANIES_DATABASE_ID || "",
    sheetsWebhookUrl: process.env.SHEETS_WEBHOOK_URL || "",
    writerSystemPrompt: "",
    writerProfile: "",
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
    if (key === "imapPort") {
      const port = Number(value)
      if (Number.isFinite(port) && port > 0) next.imapPort = port
      continue
    }
    if (key === "imapSecure") {
      next.imapSecure = Boolean(value)
      continue
    }
    if (typeof value === "string") {
      next[key] = value.trim() as never
    }
  }
  return next
}

async function normalizeResumeName(settings: Settings) {
  if (path.basename(settings.resumePath).toLowerCase() !== "resume.pdf") return settings
  const oldPath = path.isAbsolute(settings.resumePath)
    ? settings.resumePath
    : path.join(process.cwd(), "data", "resume.pdf")
  const nextPath = path.join(process.cwd(), DEFAULT_RESUME)
  try {
    await access(nextPath)
  } catch {
    try {
      await rename(oldPath, nextPath)
    } catch {
      // No existing upload to migrate.
    }
  }
  return { ...settings, resumePath: DEFAULT_RESUME }
}

export async function loadSettings(): Promise<Settings> {
  const env = fromEnv()
  try {
    const raw = await readFile(FILE, "utf8")
    const saved = JSON.parse(raw) as Partial<Settings>
    return normalizeResumeName(overlay(env, saved))
  } catch {
    return normalizeResumeName(env)
  }
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await loadSettings()
  const next = overlay(current, patch)
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(next, null, 2))
  return next
}

async function resumeExists(resumePath: string) {
  const resolved = path.isAbsolute(resumePath)
    ? resumePath
    : path.join(process.cwd(), "data", path.basename(resumePath))
  try {
    await access(resolved)
    return true
  } catch {
    return false
  }
}

export function resolveResumePath(settings: Settings) {
  if (path.isAbsolute(settings.resumePath)) return settings.resumePath
  const base = path.join(process.cwd(), "data")
  const name = path.basename(settings.resumePath)
  return path.join(base, name)
}

export async function defaultWriterProfile() {
  try {
    return await readFile(path.join(process.cwd(), "MEMORY.md"), "utf8")
  } catch {
    return ""
  }
}

export function storedPrompt(value: string | undefined, fallback: string) {
  if (typeof value !== "string") return undefined
  const text = value.replace(/\r\n/g, "\n").trim()
  const base = fallback.replace(/\r\n/g, "\n").trim()
  if (!text || text === base) return ""
  return text
}

export async function resolveWriterProfile(settings: Pick<Settings, "writerProfile">) {
  const custom = settings.writerProfile?.replace(/\r\n/g, "\n").trim()
  if (custom) return custom
  return defaultWriterProfile()
}

export async function toPublic(settings: Settings): Promise<PublicSettings> {
  const profileDefault = await defaultWriterProfile()
  return {
    senderName: settings.senderName,
    senderEmail: settings.senderEmail,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser,
    smtpConfigured: Boolean(settings.smtpHost && settings.senderEmail),
    imapHost: settings.imapHost,
    imapPort: settings.imapPort,
    imapSecure: settings.imapSecure,
    imapConfigured: Boolean(settings.imapHost && settings.smtpUser && settings.smtpPass),
    resumePath: settings.resumePath,
    resumeConfigured: await resumeExists(settings.resumePath),
    notionDatabaseId: settings.notionDatabaseId,
    notionCompaniesDatabaseId: settings.notionCompaniesDatabaseId,
    notionConfigured: Boolean(settings.notionToken && settings.notionDatabaseId),
    sheetsWebhookUrl: settings.sheetsWebhookUrl,
    sheetsConfigured: Boolean(settings.sheetsWebhookUrl),
    lockRequired: Boolean(process.env.FIELDNOTE_PASSWORD?.trim()),
    writerSystemPrompt: resolveWriterSystem(settings.writerSystemPrompt),
    writerProfile: settings.writerProfile.trim() || profileDefault,
    writerSystemDefault: writerSystem(),
    writerProfileDefault: profileDefault,
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
