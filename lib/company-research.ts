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

function normalizedWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !/^(?:the|and|pvt|ltd|llp|inc|limited|solutions?|technologies)$/.test(word))
}

export function companySiteCandidates(html: string, company = "") {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => safeDecode(match[1]))
  const candidates: Array<{ url: string; score: number; order: number }> = []
  for (const href of hrefs) {
    const target = unwrap(href)
    if (!target) continue
    try {
      const url = new URL(target)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      const host = url.hostname.replace(/^www\./i, "").toLowerCase()
      if (!host.includes(".") || BLOCKED_HOST.test(host)) continue
      const hostKey = host.replace(/[^a-z0-9]/g, "")
      const words = normalizedWords(company)
      const companyKey = words.join("")
      const score =
        (companyKey && hostKey.includes(companyKey) ? 100 : 0) +
        words.reduce((total, word) => total + (hostKey.includes(word) ? 20 : 0), 0)
      const canonical = `${url.protocol}//${url.host}/`
      if (!candidates.some((item) => item.url === canonical)) {
        candidates.push({ url: canonical, score, order: candidates.length })
      }
    } catch {
      continue
    }
  }
  return candidates
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((candidate) => candidate.url)
}

export function firstCompanySite(html: string, company = "") {
  return companySiteCandidates(html, company)[0] ?? ""
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
  const type = response.headers.get("content-type")?.toLowerCase() ?? ""
  if (type && !type.includes("text/html") && !type.includes("text/plain")) return null
  const declared = Number(response.headers.get("content-length") ?? 0)
  if (declared > 1_500_000) return null
  const text = await response.text()
  return text.length <= 1_500_000 ? text : null
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
    if (!sameCompanyHost(new URL(response.url).hostname, new URL(origin).hostname)) return null
    const text = await response.text()
    return text.length <= 500_000 ? text : null
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
  const site = firstCompanySite(html, name)
  if (!site) return ""
  return new URL(site).hostname.replace(/^www\./i, "").toLowerCase()
}

function sameCompanyHost(actual: string, expected: string) {
  const clean = (host: string) => host.toLowerCase().replace(/^www\./, "")
  const a = clean(actual)
  const e = clean(expected)
  return a === e || a.endsWith(`.${e}`) || e.endsWith(`.${a}`)
}

async function fetchCompanyHtml(url: string, userAgent: string, domain: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "text/html,text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok || !sameCompanyHost(new URL(response.url).hostname, domain)) return null
    const type = response.headers.get("content-type")?.toLowerCase() ?? ""
    if (type && !type.includes("text/html") && !type.includes("text/plain")) return null
    const declared = Number(response.headers.get("content-length") ?? 0)
    if (declared > 1_500_000) return null
    const html = await response.text()
    if (html.length > 1_500_000) return null
    return { html, url: response.url }
  } catch {
    return null
  }
}

function aboutPaths(html: string, origin: string) {
  const paths: string[] = []
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(safeDecode(match[1]), origin)
      if (url.origin !== origin) continue
      if (!/^\/(?:about(?:-us)?|company|who-we-are)\/?$/i.test(url.pathname)) continue
      if (!paths.includes(url.pathname)) paths.push(url.pathname)
    } catch {
      continue
    }
  }
  return paths.slice(0, 3)
}

export async function readCompanyPage(domain: string) {
  const origin = `https://${domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`
  const robots = await readRobots(origin)
  if (robots === null) return null
  const paths = ["/", "/about", "/about-us"]
  let best: { url: string; text: string } | null = null
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index]
    if (!robotsAllows(robots, path)) continue
    const url = `${origin}${path === "/" ? "/" : path}`
    let page = await fetchCompanyHtml(url, BOT_UA, domain)
    if (page === null) page = await fetchCompanyHtml(url, BROWSER_UA, domain)
    if (!page) continue
    if (path === "/") {
      for (const discovered of aboutPaths(page.html, new URL(page.url).origin)) {
        if (!paths.includes(discovered)) paths.push(discovered)
      }
    }
    const text = htmlToText(page.html).slice(0, 8000)
    const score = (path === "/" ? 0 : 10_000) + text.length
    const bestScore = best ? (new URL(best.url).pathname === "/" ? 0 : 10_000) + best.text.length : -1
    if (score > bestScore) best = { url: page.url, text }
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
