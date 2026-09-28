import { roleLines } from "./parse"
import type { EmailDraft, ParsedBrief } from "./types"

function firstName(name: string) {
  const cleaned = name.replace(/[’']/g, "'").trim()
  if (!cleaned) return ""
  const token = cleaned.split(/\s+/)[0] ?? ""
  if (!token || token.length < 2 || /[#@]/.test(token)) return ""
  return token
}

function clip(value: string, max: number) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

export function buildDraft(
  brief: Pick<
    ParsedBrief,
    "kind" | "title" | "company" | "location" | "authorName" | "description" | "emails"
  >,
  sender: { name: string; email: string }
): EmailDraft {
  const name = firstName(brief.authorName)
  const greeting = name
    ? `Hi ${name},`
    : brief.company
      ? `Hi ${brief.company} team,`
      : "Hello,"
  const signature = ["Thanks,", sender.name.trim() || "[Your name]", sender.email.trim()]
    .filter(Boolean)
    .join("\n")

  if (brief.kind === "job") {
    const where = [
      brief.company ? ` at ${brief.company}` : "",
      brief.location ? ` (${brief.location})` : "",
    ].join("")
    const subject = clip(
      brief.company ? `${brief.title} — ${brief.company}` : brief.title || "Role on LinkedIn",
      120
    )
    return {
      to: brief.emails[0] ?? "",
      subject,
      body: [
        greeting,
        "",
        `I came across the ${brief.title || "open role"}${where} and wanted to introduce myself.`,
        "",
        "I can share a short background and availability if it is useful. Would you be open to a brief conversation?",
        "",
        signature,
      ].join("\n"),
    }
  }

  const roles = roleLines(brief.description).slice(0, 16)
  const subject = clip(
    brief.title ? `Regarding your post: ${brief.title}` : "Following up on your LinkedIn post",
    120
  )
  const roleBlock = roles.length
    ? ["You mentioned:", ...roles.map((role) => `- ${role}`), ""]
    : []

  return {
    to: brief.emails[0] ?? "",
    subject,
    body: [
      greeting,
      "",
      "I saw your LinkedIn post and wanted to follow up directly.",
      "",
      ...roleBlock,
      "If this is still open, I can reply with a relevant profile or requirement. Happy to take a short call.",
      "",
      signature,
    ].join("\n"),
  }
}
