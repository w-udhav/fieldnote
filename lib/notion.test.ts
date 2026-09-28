import assert from "node:assert/strict"
import test from "node:test"
import { draftFromNotionBrief, notionPageToBrief } from "./notion"
import type { EmailDraft } from "./types"

const schema = {
  properties: {
    Name: { type: "title" },
    Company: { type: "rich_text" },
    Author: { type: "rich_text" },
    Workflow: { type: "select" },
    Status: { type: "select" },
    "Record ID": { type: "rich_text" },
    "AI Subject": { type: "rich_text" },
    "AI Body": { type: "rich_text" },
    "Draft To": { type: "email" },
    URL: { type: "url" },
    Published: { type: "date" },
    "Last Reply Snippet": { type: "rich_text" },
    "Has Unread Reply": { type: "checkbox" },
  },
}

test("notionPageToBrief maps dashboard fields", () => {
  const brief = notionPageToBrief(
    {
      id: "page-1",
      url: "https://notion.so/page-1",
      last_edited_time: "2026-03-15T10:00:00.000Z",
      properties: {
        Name: { title: [{ plain_text: "Backend Engineer" }] },
        Company: { rich_text: [{ plain_text: "Northwind" }] },
        Author: { rich_text: [{ plain_text: "Ada Stone" }] },
        Workflow: { select: { name: "Ready" } },
        Status: { select: { name: "Filed" } },
        "Record ID": { rich_text: [{ plain_text: "abc-123" }] },
        "AI Subject": { rich_text: [{ plain_text: "Backend role" }] },
        "AI Body": { rich_text: [{ plain_text: "Hello there" }] },
        "Draft To": { email: "jobs@northwind.example" },
        URL: { url: "https://www.linkedin.com/jobs/view/1" },
        Published: { date: { start: "2026-03-10" } },
        "Last Reply Snippet": { rich_text: [{ plain_text: "Thanks for reaching out" }] },
        "Has Unread Reply": { checkbox: true },
      },
    },
    schema
  )

  assert.equal(brief.title, "Backend Engineer")
  assert.equal(brief.company, "Northwind")
  assert.equal(brief.workflow, "Ready")
  assert.equal(brief.recordId, "abc-123")
  assert.equal(brief.aiSubject, "Backend role")
  assert.equal(brief.draftTo, "jobs@northwind.example")
  assert.equal(brief.hasUnreadReply, true)
})

test("draftFromNotionBrief prefers AI copy when Ready", () => {
  const fallback: EmailDraft = { to: "", subject: "Template", body: "Template body" }
  const draft = draftFromNotionBrief(
    {
      pageId: "p",
      recordId: "id",
      notionUrl: null,
      title: "Role",
      company: "Co",
      authorName: "",
      publishedAt: null,
      workflow: "Ready",
      status: "Filed",
      kind: "job",
      finalUrl: null,
      draftTo: "hire@co.example",
      aiSubject: "AI subject",
      aiBody: "AI body",
      sentMessageId: null,
      lastReplyAt: null,
      lastReplySnippet: "",
      hasUnreadReply: false,
      updatedAt: "",
    },
    fallback
  )
  assert.equal(draft.subject, "AI subject")
  assert.equal(draft.body, "AI body")
  assert.equal(draft.to, "hire@co.example")
})
