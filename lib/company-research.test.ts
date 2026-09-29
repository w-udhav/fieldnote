import assert from "node:assert/strict"
import test from "node:test"
import {
  companyFactsFromModel,
  firstCompanySite,
  quoteFromPage,
  readCompanyPage,
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

test("official-domain resolution ranks a company match above an unrelated first result", () => {
  const html = `
    <a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fdirectory.example%2Fjuspay">Directory</a>
    <a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fjuspay.io%2Fabout">Juspay</a>
  `
  assert.equal(firstCompanySite(html, "Juspay"), "https://juspay.io/")
})

test("company fetching checks the about page even when the homepage is substantial", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch
  const response = (url: string, body: string, type: string) => {
    const result = new Response(body, { headers: { "content-type": type } })
    Object.defineProperty(result, "url", { value: url })
    return result
  }
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith("/robots.txt")) {
      return response(url, "User-agent: *\nAllow: /", "text/plain")
    }
    if (url.endsWith("/about") || url.endsWith("/about-us")) {
      return response(
        url,
        "<h1>About Juspay</h1><p>Juspay builds payment infrastructure.</p>",
        "text/html"
      )
    }
    return response(url, `<a href="/about">About</a><p>${"Homepage ".repeat(100)}</p>`, "text/html")
  }
  try {
    const page = await readCompanyPage("juspay.io")
    assert.equal(page?.url, "https://juspay.io/about")
    assert.match(page?.text ?? "", /builds payment infrastructure/)
  } finally {
    globalThis.fetch = originalFetch
  }
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
