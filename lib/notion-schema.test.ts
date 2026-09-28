import assert from "node:assert/strict"
import test from "node:test"
import { notionSchemaReset } from "./notion"

test("notionSchemaReset drops old columns and renames the title", () => {
  const plan = notionSchemaReset([
    { name: "Name", type: "title" },
    { name: "Notes", type: "rich_text" },
    { name: "Company", type: "select" },
  ])
  assert.equal(plan.titleName, "Name")
  assert.equal(plan.renameTitle, true)
  assert.equal(plan.remove.Notes, null)
  assert.equal(plan.remove.Company, null)
  assert.equal("Name" in plan.remove, false)
  assert.ok(plan.create.Workflow)
  assert.ok(plan.create["AI Body"])
})
