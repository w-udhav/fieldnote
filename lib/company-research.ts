import { htmlToText } from "./parse"
import { llmBaseUrl, llmChatRequest } from "./writer"

const BLOCKED_HOST =
  /(^|\.)(linkedin\.com|lnkd\.in|facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|wikipedia\.org|google\.com|bing\.com|duckduckgo\.com|reddit\.com|glassdoor\.com|indeed\.com|naukri\.com)$/i

const BOT_UA = "Fieldnote/1.0 (company research)"
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

export type SourcedCompany = {
  domain: string
  whatTheyDo: string
  product: string
  hook: string
  sourceUrl: string
}

export function robotsAllows(robots: string, pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  const lines = robots.split(/\r?\n/)
  let star = false
  let seenStar = false
  const allows: string[] = []
  const disallows: string[] = []
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim()
    if (!line) continue
    const split = line.indexOf(":")
    if (split < 0) continue
    const key = line.slice(0, split).trim().toLowerCase()
    const value = line.slice(split + 1).trim()
    if (key === "user-agent") {
      if (seenStar && star) break
      star = value === "*"
      if (star) seenStar = true
      continue
    }
    if (!star) continue
    if (key === "allow" && value) allows.push(value)
    if (key === "disallow" && value) disallows.push(value)
  }
  const match = (rules: string[]) =>
    rules.filter((rule) => path.startsWith(rule)).sort((a, b) => b.length - a.length)[0] ?? ""
  const allow = match(allows)
  const disallow = match(disallows)
  if (allow && (!disallow || allow.length >= disallow.length)) return true
  return !disallow
}

function safeDecode(value: string) {
  const text = value.replace(/&amp;/g, "&")
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

export function firstCompanySite(html: string) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => safeDecode(match[1]))
  for (const href of hrefs) {
    const target = unwrap(href)
    if (!target) continue
    try {
      const url = new URL(target)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      const host = url.hostname.replace(/^www\./i, "").toLowerCase()
      if (!host.includes(".") || BLOCKED_HOST.test(host)) continue
      return `${url.protocol}//${url.host}/`
    } catch {
      continue
    }
  }
  return ""
}

function unwrap(href: string) {
  try {
    const absolute = href.startsWith("//") ? `https:${href}` : href
    const url = new URL(absolute, "https://duckduckgo.com")
    const uddg = url.searchParams.get("uddg")
    if (uddg) return uddg
    if (url.hostname.toLowerCase().includes("duckduckgo")) return ""
    return url.toString()
  } catch {
    return ""
  }
}

export function quoteFromPage(value: unknown, page: string) {
  if (typeof value !== "string") return ""
  const phrase = value.replace(/\s+/g, " ").trim()
  if (!phrase || phrase.length > 280) return ""
  if (/urgently hiring/i.test(phrase)) return ""
  const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ")
  if (!norm(page).includes(norm(phrase))) return ""
  return phrase
}

export function companyFactsFromModel(raw: string, page: string) {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  const empty = { whatTheyDo: "", product: "", hook: "" }
  if (start < 0 || end <= start) return empty
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    return {
      whatTheyDo: quoteFromPage(parsed.what_they_do, page),
      product: quoteFromPage(parsed.product, page),
      hook: quoteFromPage(parsed.hook, page),
    }
  } catch {
    return empty
  }
}

export function shouldResearch(
  profile: { sourceUrl: string; fetchedAt: string } | null,
  today = new Date().toISOString().slice(0, 10)
) {
  if (!profile) return true
  if (profile.sourceUrl.trim()) return false
  if (!profile.fetchedAt.trim()) return true
  return profile.fetchedAt.slice(0, 10) < today
}

async function fetchText(url: string, userAgent: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "text/html,text/plain" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) return null
  return response.text()
}

async function readRobots(origin: string) {
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": BOT_UA, Accept: "text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    })
    if (response.status === 404) return ""
    if (!response.ok) return null
    return response.text()
  } catch {
    return null
  }
}

export async function resolveDomain(name: string, known: string) {
  const host = known.trim().replace(/^www\./i, "").toLowerCase()
  if (host.includes(".") && !BLOCKED_HOST.test(host)) return host
  const query = encodeURIComponent(`${name} official website`)
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${query}`, BROWSER_UA)
  if (!html) return ""
  const site = firstCompanySite(html)
  if (!site) return ""
  return new URL(site).hostname.replace(/^www\./i, "").toLowerCase()
}

export async function readCompanyPage(domain: string) {
  const origin = `https://${domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`
  const robots = await readRobots(origin)
  if (robots === null) return null
  const paths = ["/", "/about", "/about-us"]
  let best: { url: string; text: string } | null = null
  for (const path of paths) {
    if (!robotsAllows(robots, path)) continue
    const url = `${origin}${path === "/" ? "/" : path}`
    let html = await fetchText(url, BOT_UA)
    if (html === null) html = await fetchText(url, BROWSER_UA)
    if (!html) continue
    const text = htmlToText(html).slice(0, 8000)
    if (!best || text.length > best.text.length) best = { url, text }
    if (path === "/" && text.length >= 400) break
  }
  return best
}

export async function requestCompanyFacts(company: string, pageUrl: string, page: string) {
  const empty = { whatTheyDo: "", product: "", hook: "" }
  try {
    const response = await fetch(`${llmBaseUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        llmChatRequest({
          model: process.env.LLM_MODEL,
          system: [
            "You extract facts from one company page.",
            "Return JSON with what_they_do, product, and hook.",
            "Each value is a short phrase copied from the page, or an empty string.",
            "Do not mention hiring, jobs, or the reader. Do not invent.",
          ].join(" "),
          user: `Company: ${company}\nPage: ${pageUrl}\n\n${page.slice(0, 6000)}`,
        })
      ),
      signal: AbortSignal.timeout(180000),
    })
    if (!response.ok) return empty
    const json = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[]
    }
    return companyFactsFromModel(json.choices?.[0]?.message?.content ?? "", page)
  } catch {
    return empty
  }
}

export async function researchCompany(input: { name: string; domain: string }): Promise<SourcedCompany> {
  const empty: SourcedCompany = { domain: "", whatTheyDo: "", product: "", hook: "", sourceUrl: "" }
  try {
    const domain = await resolveDomain(input.name, input.domain)
    if (!domain) return empty
    const page = await readCompanyPage(domain)
    if (!page?.text.trim()) return { ...empty, domain }
    const facts = await requestCompanyFacts(input.name, page.url, page.text)
    return { domain, ...facts, sourceUrl: page.url }
  } catch {
    return empty
  }
}
