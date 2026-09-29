import { researchCompany, shouldResearch } from "./company-research"
import { renderLetter } from "./letter"
import { findCompany, saveCompany } from "./notion"
import { extractPostFacts } from "./parse"
import { extractJobCategories } from "./job-categories"
import type { BriefKind, Settings } from "./types"

export async function draftOutreach(input: {
  settings: Settings
  title: string
  company: string
  authorName: string
  description: string
  kind?: BriefKind
}) {
  const facts = extractPostFacts({
    title: input.title,
    description: input.description,
    company: input.company,
    authorName: input.authorName,
    kind: input.kind,
  })
  const company = facts.company || input.company.trim()
  const role = facts.role || (input.title.trim() && !/linkedin|good morning/i.test(input.title) ? input.title.trim() : "")
  const categories = extractJobCategories(`${role}\n${input.description}`)
  let hook = ""
  let whatTheyDo = ""
  let sourceUrl = ""

  const token = input.settings.notionToken.trim()
  const databaseId = input.settings.notionCompaniesDatabaseId.trim()
  if (company && token && databaseId) {
    try {
      const existing = await findCompany(token, databaseId, company)
      if (!shouldResearch(existing)) {
        hook = existing?.hook ?? ""
        whatTheyDo = existing?.whatTheyDo ?? ""
        sourceUrl = existing?.sourceUrl ?? ""
      } else {
        const found = await researchCompany({
          name: company,
          domain: facts.domain || existing?.domain || "",
        })
        const saved = await saveCompany(token, databaseId, {
          pageId: existing?.pageId ?? null,
          name: company,
          domain: found.domain || facts.domain || existing?.domain || "",
          whatTheyDo: found.whatTheyDo,
          product: found.product,
          hook: found.hook,
          sourceUrl: found.sourceUrl,
          fetchedAt: new Date().toISOString().slice(0, 10),
        })
        hook = saved.hook
        whatTheyDo = saved.whatTheyDo
        sourceUrl = saved.sourceUrl
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
    }
  }

  const letter = renderLetter({
    contactName: facts.contactName,
    company,
    role,
    hook,
    whatTheyDo,
    sourceUrl,
    categories,
    senderName: input.settings.senderName,
  })
  return { ...letter, company, role, categories }
}
