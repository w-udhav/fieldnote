import { IntakeError } from "./errors"
import { fileParsedBrief } from "./file-brief"
import { fetchLinkedInPage } from "./linkedin"
import { parseLinkedInHtml } from "./parse"

export async function intakeLinkedInUrl(rawUrl: string) {
  const url = rawUrl.trim()
  if (!url) throw new IntakeError("Paste a LinkedIn URL.", "empty")
  const page = await fetchLinkedInPage(url)
  const brief = parseLinkedInHtml(page.html, page.finalUrl, url)
  return fileParsedBrief(brief)
}
