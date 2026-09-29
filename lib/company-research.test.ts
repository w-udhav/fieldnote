import assert from "node:assert/strict"
import test from "node:test"
import {
  companyFactsFromModel,
  firstCompanySite,
  quoteFromPage,
  robotsAllows,
  shouldResearch,
} from "./company-research"

test("robots.txt blocks a disallowed path and allows a more specific allow", () => {
  const robots = "User-agent: *\nDisallow: /\nAllow: /about\n\nUser-agent: other\nDisallow: /about"
  assert.equal(robotsAllows(robots, "/"), false)
  assert.equal(robotsAllows(robots, "/about"), true)
  assert.equal(robotsAllows("User-agent: *\nDisallow:", "/"), true)
})

test("search results skip social sites and unwrap the result link", () => {
  const html = `
    <a href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.linkedin.com%2Fcompany%2Fnorthwind">LinkedIn</a>
    <a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.northwind.example%2Fabout">Northwind</a>
  `
  assert.equal(firstCompanySite(html), "https://www.northwind.example/")
})

test("model facts must be quotes from the fetched page", () => {
  const page = "Northwind builds intake software for shippers. The product is called Ledger."
  assert.equal(quoteFromPage("builds intake software for shippers", page), "builds intake software for shippers")
  assert.equal(quoteFromPage("is urgently hiring engineers", page), "")
  assert.equal(quoteFromPage("cuts latency from 15 to 3 seconds", page), "")
  const facts = companyFactsFromModel(
    JSON.stringify({
      what_they_do: "builds intake software for shippers",
      product: "Ledger",
      hook: "a made up hiring blurb",
    }),
    page
  )
  assert.equal(facts.whatTheyDo, "builds intake software for shippers")
  assert.equal(facts.product, "Ledger")
  assert.equal(facts.hook, "")
})

test("a sourced company is not fetched again, and a failed fetch can retry the next day", () => {
  assert.equal(shouldResearch(null, "2026-09-29"), true)
  assert.equal(
    shouldResearch({ sourceUrl: "https://northwind.example/", fetchedAt: "2026-09-29" }, "2026-09-29"),
    false
  )
  assert.equal(shouldResearch({ sourceUrl: "", fetchedAt: "2026-09-29" }, "2026-09-29"), false)
  assert.equal(shouldResearch({ sourceUrl: "", fetchedAt: "2026-09-28" }, "2026-09-29"), true)
})
