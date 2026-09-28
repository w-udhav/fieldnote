import assert from "node:assert/strict"
import test from "node:test"
import { parseModelJson } from "./writer"

test("parseModelJson reads a fenced-looking object", () => {
  const draft = parseModelJson('Here you go:\n{"subject":"Backend role","body":"Hello team"}')
  assert.equal(draft.subject, "Backend role")
  assert.equal(draft.body, "Hello team")
})

test("parseModelJson rejects an empty body", () => {
  assert.throws(() => parseModelJson('{"subject":"Hi","body":"  "}'))
})
