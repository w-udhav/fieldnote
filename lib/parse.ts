import { IntakeError } from "./errors"
import type { BriefKind, ParsedBrief } from "./types"

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_RE = /(?:\+\d{1,3}[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu

const EMAIL_BLOCKLIST =
  /@(?:linkedin\.com|licdn\.com|example\.com|sentry\.io|wixpress\.com|schema\.org|email\.com)$/i

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code)
      return Number.isFinite(n) ? String.fromCodePoint(n) : _
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const n = Number.parseInt(code, 16)
      return Number.isFinite(n) ? String.fromCodePoint(n) : _
    })
}

export function htmlToText(value: string) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function metaContent(html: string, key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`,
      "i"
    ),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeEntities(match[1])
  }
  return ""
}

function readJsonLd(html: string): unknown[] {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )
  const items: unknown[] = []
  for (const block of blocks) {
    const raw = decodeEntities(block[1] ?? "").trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        items.push(...parsed)
      } else if (parsed && typeof parsed === "object" && "@graph" in parsed) {
        const graph = (parsed as { "@graph"?: unknown })["@graph"]
        if (Array.isArray(graph)) items.push(...graph)
      } else {
        items.push(parsed)
      }
    } catch {
      continue
    }
  }
  return items
}

function typeNames(value: unknown): string[] {
  if (!value || typeof value !== "object") return []
  const type = (value as { "@type"?: unknown })["@type"]
  if (typeof type === "string") return [type.toLowerCase()]
  if (Array.isArray(type)) {
    return type.filter((item) => typeof item === "string").map((item) => item.toLowerCase())
  }
  return []
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  const record = asRecord(value)
  if (!record) return ""
  if (typeof record.name === "string") return record.name.trim()
  if (typeof record.text === "string") return record.text.trim()
  return ""
}

function formatLocation(value: unknown): string {
  const entries = Array.isArray(value) ? value : value ? [value] : []
  const labels = entries
    .map((entry) => {
      const record = asRecord(entry)
      if (!record) return ""
      const address = asRecord(record.address) ?? record
      const locality = textValue(address.addressLocality)
      const region = textValue(address.addressRegion)
      const country = textValue(address.addressCountry)
      const named = [locality, region, country].filter(Boolean)
      if (named.length) return named.join(", ")
      return textValue(address.name) || textValue(record.name)
    })
    .filter(Boolean)
  return [...new Set(labels)].join(" · ")
}

function unique(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

export function extractEmails(text: string) {
  return unique(
    [...text.matchAll(EMAIL_RE)]
      .map((match) => match[0].replace(/[.,;:)]+$/g, "").toLowerCase())
      .filter((email) => !EMAIL_BLOCKLIST.test(email))
  )
}

export function extractPhones(text: string) {
  return unique(
    [...text.matchAll(PHONE_RE)].map((match) => match[0].replace(/\s+/g, " ").trim())
  )
}

export function extractHashtags(text: string) {
  return unique([...text.matchAll(HASHTAG_RE)].map((match) => match[0].toLowerCase())).slice(0, 40)
}

export function roleLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => {
      if (!line || line.length > 70 || line.length < 3) return false
      if (/[@#]|https?:|www\./i.test(line)) return false
      const words = line.split(/\s+/)
      if (words.length < 2 || words.length > 8) return false
      if (/^(good morning|happy |note\b|please |if you|i have|i am|this post)/i.test(line)) {
        return false
      }
      if (/\b(available|looking|reach|please|morning|monday|linkedin)\b/i.test(line)) return false
      return /[A-Za-z]/.test(line)
    })
    .slice(0, 20)
}

function pageTitle(html: string) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i)
  return match?.[1] ? htmlToText(match[1]) : ""
}

function kindFromUrl(url: string): BriefKind {
  try {
    const path = new URL(url).pathname.toLowerCase()
    if (path.includes("/jobs/")) return "job"
    if (path.includes("/posts/") || path.includes("/feed/")) return "post"
  } catch {
    return "page"
  }
  return "page"
}

function clip(value: string, max: number) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

export function parseLinkedInHtml(html: string, finalUrl: string, sourceUrl: string): ParsedBrief {
  const nodes = readJsonLd(html)
  const job = nodes.find((node) => typeNames(node).includes("jobposting"))
  const post = nodes.find((node) =>
    typeNames(node).some((type) =>
      ["socialmediaposting", "discussionforumposting", "article"].includes(type)
    )
  )
  const jobRecord = asRecord(job)
  const postRecord = asRecord(post)
  const ogTitle = metaContent(html, "og:title")
  const ogDescription = metaContent(html, "og:description")
  const documentTitle = pageTitle(html)

  let kind: BriefKind = jobRecord ? "job" : postRecord ? "post" : kindFromUrl(finalUrl)
  let title = ""
  let description = ""
  let company = ""
  let location = ""
  let employmentType = ""
  let authorName = ""
  let authorUrl = ""
  let publishedAt: string | null = null

  if (jobRecord) {
    title = textValue(jobRecord.title)
    const rawDescription = jobRecord.description
    description = htmlToText(
      typeof rawDescription === "string" ? rawDescription : textValue(rawDescription)
    )
    const org = asRecord(jobRecord.hiringOrganization)
    company = textValue(org?.name) || textValue(jobRecord.hiringOrganization)
    location = formatLocation(jobRecord.jobLocation)
    const employment = jobRecord.employmentType
    employmentType = Array.isArray(employment)
      ? employment.map((item) => textValue(item)).filter(Boolean).join(", ")
      : textValue(employment)
    publishedAt = textValue(jobRecord.datePosted) || null
  } else if (postRecord) {
    const body = textValue(postRecord.articleBody) || textValue(postRecord.text)
    description = body
    const headline = textValue(postRecord.headline)
    const firstLine = body.split("\n").map((line) => line.trim()).find(Boolean) ?? ""
    title = headline || firstLine || ogTitle.split("|")[0]?.trim() || ""
    const author = asRecord(postRecord.author)
    authorName = textValue(author?.name)
    authorUrl = textValue(author?.url)
    publishedAt = textValue(postRecord.datePublished) || null
    if (!company) company = ""
  }

  if (!description) description = htmlToText(ogDescription)
  if (!title) {
    title = ogTitle.split("|")[0]?.trim() || documentTitle.split("|")[0]?.trim() || ""
  }
  if (!authorName && ogTitle.includes("|")) {
    authorName = ogTitle.split("|").pop()?.trim() ?? ""
  }

  title = clip(title.replace(/\s+/g, " ").trim(), 180)
  description = clip(description, 12000)

  const contactSource = [title, description, authorName].filter(Boolean).join("\n")
  const emails = extractEmails(contactSource)
  const phones = extractPhones(contactSource)
  const hashtags = extractHashtags(description)

  const loginWall = /authwall|join linkedin|sign in|login__form|unauthorized/i.test(
    `${documentTitle}\n${title}\n${html.slice(0, 5000)}`
  )
  const genericTitle = /^(sign in|sign up|log in|join|linkedin)$/i.test(title)
  if ((!title || genericTitle) && !description && loginWall) {
    throw new IntakeError(
      "LinkedIn is showing a sign-in wall for this link. Public posts and some job pages can be read. Pages that require a login cannot.",
      "login_wall"
    )
  }
  if ((!title || genericTitle) && !description) {
    throw new IntakeError(
      "The public page did not include a job or post. Try the full linkedin.com URL for a public job or post.",
      "empty"
    )
  }
  if (genericTitle) title = ""
  if (kind === "page" && /\/jobs\//i.test(finalUrl)) kind = "job"

  return {
    sourceUrl,
    finalUrl,
    kind,
    title: title || "Untitled LinkedIn page",
    company,
    location,
    employmentType,
    authorName,
    authorUrl,
    publishedAt,
    description,
    emails,
    phones,
    hashtags,
  }
}
