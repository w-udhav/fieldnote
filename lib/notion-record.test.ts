import assert from "node:assert/strict"
import test from "node:test"
import { recordFromNotion } from "./notion-record"
import type { NotionBrief } from "./types"

function notion(partial: Partial<NotionBrief> = {}): NotionBrief {
  return {
    pageId: "page-1",
    recordId: "a237400d-8d57-4c24-ba4e-af82e13c2189",
    notionUrl: "https://notion.so/page-1",
    title: "Node JS Developer",
    company: "Codeverse",
    authorName: "Ada",
    publishedAt: "2026-09-28",
    workflow: "Ready",
    status: "Filed",
    kind: "post",
    finalUrl: "https://www.linkedin.com/posts/ada",
    draftTo: "hr@weenggs.com",
    aiSubject: "Node JS Developer — Codeverse",
    aiBody: "Hi Ada,\n\nI would be glad to talk.",
    sentMessageId: null,
    lastReplyAt: null,
    lastReplySnippet: "",
    hasUnreadReply: false,
    updatedAt: "2026-09-29T10:00:00.000Z",
    ...partial,
  }
}

test("a Notion row becomes a local brief even when this machine never filed it", () => {
  const record = recordFromNotion(notion(), "The posting text")
  assert.equal(record.id, "a237400d-8d57-4c24-ba4e-af82e13c2189")
  assert.equal(record.title, "Node JS Developer")
  assert.equal(record.company, "Codeverse")
  assert.equal(record.description, "The posting text")
  assert.equal(record.draft.to, "hr@weenggs.com")
  assert.equal(record.draft.body, "Hi Ada,\n\nI would be glad to talk.")
  assert.equal(record.destinations.notion.pageId, "page-1")
  assert.equal(record.status, "filed")
})

test("a Notion page with no record id uses the page id", () => {
  const record = recordFromNotion(notion({ recordId: null, workflow: "Sent", status: "Sent" }))
  assert.equal(record.id, "page-1")
  assert.equal(record.status, "sent")
})
