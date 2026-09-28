import assert from "node:assert/strict"
import test from "node:test"
import { applyNotionDraft } from "./merge-notion"
import type { BriefRecord, NotionBrief } from "./types"

function record(partial: Partial<BriefRecord> = {}): BriefRecord {
  return {
    id: "abc",
    createdAt: "",
    updatedAt: "",
    status: "filed",
    sentMessageId: null,
    sourceUrl: "https://www.linkedin.com/jobs/view/1",
    finalUrl: "https://www.linkedin.com/jobs/view/1",
    kind: "job",
    title: "Backend Engineer",
    company: "",
    location: "",
    employmentType: "",
    authorName: "Ada",
    authorUrl: "",
    publishedAt: null,
    description: "Ships APIs.",
    emails: [],
    phones: [],
    hashtags: [],
    draft: { to: "", subject: "Template", body: "Template body" },
    draftEdited: false,
    sentAt: null,
    sendError: null,
    destinations: {
      local: { status: "filed" },
      notion: { status: "filed" },
      sheets: { status: "skipped" },
    },
    ...partial,
  }
}

function notion(partial: Partial<NotionBrief> = {}): NotionBrief {
  return {
    pageId: "page-1",
    recordId: "abc",
    notionUrl: null,
    title: "Backend Engineer",
    company: "Northwind",
    authorName: "Ada",
    publishedAt: null,
    workflow: "Ready",
    status: "Filed",
    kind: "job",
    finalUrl: "https://www.linkedin.com/jobs/view/1",
    draftTo: "jobs@northwind.example",
    aiSubject: "Backend role at Northwind",
    aiBody: "Hello Ada,\n\nI saw the backend role.\n\nThanks,\nOrbit",
    sentMessageId: null,
    lastReplyAt: null,
    lastReplySnippet: "",
    hasUnreadReply: false,
    updatedAt: "",
    ...partial,
  }
}

test("applyNotionDraft overlays the company and the Ready email", () => {
  const merged = applyNotionDraft(record(), notion())
  assert.equal(merged.company, "Northwind")
  assert.equal(merged.draft.subject, "Backend role at Northwind")
  assert.equal(merged.draft.body, "Hello Ada,\n\nI saw the backend role.\n\nThanks,\nOrbit")
  assert.equal(merged.draft.to, "jobs@northwind.example")
})

test("applyNotionDraft keeps an edited draft and still updates the company", () => {
  const merged = applyNotionDraft(record({ draftEdited: true, company: "" }), notion())
  assert.equal(merged.company, "Northwind")
  assert.equal(merged.draft.subject, "Template")
  assert.equal(merged.draft.body, "Template body")
})

test("applyNotionDraft leaves the company alone when Notion has none", () => {
  const merged = applyNotionDraft(record({ company: "Filed Co" }), notion({ company: "  ", workflow: "Queued" }))
  assert.equal(merged.company, "Filed Co")
  assert.equal(merged.draft.subject, "Template")
})
