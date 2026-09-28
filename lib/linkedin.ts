import { IntakeError } from "./errors"

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

export function isLinkedInHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  return host === "lnkd.in" || host === "linkedin.com" || host.endsWith(".linkedin.com")
}

export function assertLinkedInUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new IntakeError("That does not look like a URL.", "invalid_url")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new IntakeError("Use an http or https LinkedIn link.", "invalid_url")
  }
  if (!isLinkedInHost(url.hostname)) {
    throw new IntakeError("Paste a linkedin.com or lnkd.in link.", "invalid_url")
  }
  return url
}

export async function fetchLinkedInPage(raw: string) {
  let current = assertLinkedInUrl(raw)

  for (let hop = 0; hop < 6; hop += 1) {
    if (!isLinkedInHost(current.hostname)) {
      throw new IntakeError("The link left LinkedIn, so it was not opened.", "blocked")
    }

    let response: Response
    try {
      response = await fetch(current, {
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": BROWSER_UA,
        },
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      throw new IntakeError("LinkedIn did not respond. Try the link again.", "network")
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location")
      if (!location) {
        throw new IntakeError("LinkedIn redirected without a destination.", "blocked")
      }
      current = new URL(location, current)
      continue
    }

    if (response.status === 999 || response.status === 401 || response.status === 403) {
      throw new IntakeError(
        "LinkedIn blocked this read. Public posts and some job pages work. This tool does not log in.",
        "blocked"
      )
    }

    if (!response.ok) {
      throw new IntakeError(`LinkedIn returned ${response.status}.`, "blocked")
    }

    const html = await response.text()
    if (html.length > 2_000_000) {
      throw new IntakeError("The page was too large to read.", "blocked")
    }
    return { finalUrl: current.toString(), html }
  }

  throw new IntakeError("Too many redirects.", "blocked")
}
