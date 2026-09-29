import assert from "node:assert/strict"
import test from "node:test"
import { extractJobCategories } from "./job-categories"

test("extracts a stable generic set from a full-stack Python JD", () => {
  const categories = extractJobCategories(
    "Python Full Stack Developer. Django REST Framework, Node.js, React.js, AWS and Docker."
  )
  assert.deepEqual(categories, [
    "Full-stack",
    "Frontend",
    "Backend",
    "Python",
    "JavaScript / TypeScript",
    "Node.js",
  ])
})

test("does not add unrelated categories", () => {
  assert.deepEqual(extractJobCategories("Senior Java Spring Boot Engineer"), ["Backend", "Java"])
})
