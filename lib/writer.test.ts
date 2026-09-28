import assert from "node:assert/strict"
import test from "node:test"
import { llmChatRequest, parseModelJson } from "./writer"

test("parseModelJson reads a fenced-looking object", () => {
  const draft = parseModelJson('Here you go:\n{"subject":"Backend role","body":"Hello team"}')
  assert.equal(draft.subject, "Backend role")
  assert.equal(draft.body, "Hello team")
  assert.equal(draft.company, "")
})

test("parseModelJson reads the hiring company", () => {
  const draft = parseModelJson('{"subject":"Backend role","body":"Hello team","company":"Northwind"}')
  assert.equal(draft.company, "Northwind")
})

test("parseModelJson drops a placeholder company", () => {
  const draft = parseModelJson('{"subject":"Backend role","body":"Hello team","company":"Unknown"}')
  assert.equal(draft.company, "")
})

test("parseModelJson rejects an empty body", () => {
  assert.throws(() => parseModelJson('{"subject":"Hi","body":"  "}'))
})

test("llmChatRequest asks llama.cpp for JSON with thinking off", () => {
  const body = llmChatRequest({ system: "Write JSON.", user: "Role: Engineer" })
  assert.deepEqual(body.response_format, { type: "json_object" })
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false })
  assert.equal(body.max_tokens, 700)
  assert.equal("model" in body, false)
  const named = llmChatRequest({ model: "qwen", system: "Write JSON.", user: "Role: Engineer" })
  assert.equal(named.model, "qwen")
})
