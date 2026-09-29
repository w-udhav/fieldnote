import assert from "node:assert/strict"
import test from "node:test"
import { llmChatRequest, parseModelJson, resolveWriterSystem, writerPrompt, writerSystem } from "./writer"

test("parseModelJson reads a fenced-looking object", () => {
  const draft = parseModelJson('Here you go:\n{"subject":"Backend role","body":"Hello team"}')
  assert.equal(draft.subject, "Backend role")
  assert.equal(draft.body, "Hello team")
  assert.equal(draft.company, "")
  assert.equal(draft.role, "")
})

test("parseModelJson reads the role", () => {
  const draft = parseModelJson('{"subject":"Hi","body":"Hello","company":"Northwind","role":"Backend engineer"}')
  assert.equal(draft.role, "Backend engineer")
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

test("writerSystem keeps rules and examples out of the candidate profile", () => {
  const prompt = writerSystem()
  assert.match(prompt, /I am writing to express my interest/)
  assert.match(prompt, /EXAMPLES/)
  assert.equal(prompt.includes("Orbitaim"), false)
})

test("resolveWriterSystem keeps a custom prompt and falls back when blank", () => {
  assert.equal(resolveWriterSystem("  "), writerSystem())
  assert.equal(resolveWriterSystem("Custom rules."), "Custom rules.")
})

test("writerPrompt puts the profile and this company in the user message", () => {
  const prompt = writerPrompt({
    profile: "Name: Udhav Wadhawan\nOrbitaim bulk-email service",
    title: "Senior Node.js Developer",
    company: "Northwind",
    authorName: "Raju",
    url: "https://example.com/job",
    description: "We are hiring someone to own our API.",
  })
  assert.match(prompt, /CANDIDATE PROFILE/)
  assert.match(prompt, /COMPANY CONTEXT/)
  assert.match(prompt, /Udhav Wadhawan/)
  assert.match(prompt, /Northwind/)
  assert.match(prompt, /Raju/)
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
