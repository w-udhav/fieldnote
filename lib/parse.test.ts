import assert from "node:assert/strict"
import test from "node:test"
import { IntakeError } from "./errors"
import { buildDraft } from "./draft"
import { assertLinkedInUrl } from "./linkedin"
import { extractEmails, extractPhones, extractPostFacts, parseLinkedInHtml, roleLines } from "./parse"

const postHtml = `
<!doctype html>
<html><head>
<title>#roles | Ada Stone</title>
<meta property="og:title" content="#roles | Ada Stone" />
<meta property="og:description" content="Consultants available." />
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "SocialMediaPosting",
  "headline": "Consultants available",
  "datePublished": "2026-09-28T13:26:22.878Z",
  "articleBody": "Consultants available\\n\\nSenior Java Full Stack Developer\\nSenior Data Engineer\\n\\nReach me at ada.stone@example-firm.com or 501-203 5079",
  "author": { "@type": "Person", "name": "Ada Stone", "url": "https://www.linkedin.com/in/ada-stone" }
}
</script>
</head><body>Sign in</body></html>`

const jobHtml = `
<script type="application/ld+json">
{
  "@type": "JobPosting",
  "title": "Staff Engineer",
  "description": "<p>Build the intake pipeline.</p><p>Email jobs@northwind.example</p>",
  "datePosted": "2026-09-01",
  "employmentType": "CONTRACTOR",
  "hiringOrganization": { "@type": "Organization", "name": "Northwind" },
  "jobLocation": { "address": { "addressLocality": "Austin", "addressRegion": "TX", "addressCountry": "US" } }
}
</script>`

test("reads a public post, contact lines, and role list", () => {
  const brief = parseLinkedInHtml(postHtml, "https://www.linkedin.com/posts/ada", "https://lnkd.in/example")
  assert.equal(brief.kind, "post")
  assert.equal(brief.authorName, "Ada Stone")
  assert.equal(brief.emails[0], "ada.stone@example-firm.com")
  assert.equal(brief.phones[0], "501-203 5079")
  assert.deepEqual(roleLines(brief.description).slice(0, 2), [
    "Senior Java Full Stack Developer",
    "Senior Data Engineer",
  ])
  const draft = buildDraft(brief, { name: "Sam Lee", email: "sam@desk.test" })
  assert.equal(draft.to, "ada.stone@example-firm.com")
  assert.match(draft.body, /Hi Ada/)
  assert.match(draft.body, /Senior Java Full Stack Developer/)
  assert.match(draft.body, /Sam Lee/)
})

test("reads a job posting", () => {
  const brief = parseLinkedInHtml(jobHtml, "https://www.linkedin.com/jobs/view/1", "https://www.linkedin.com/jobs/view/1")
  assert.equal(brief.kind, "job")
  assert.equal(brief.title, "Staff Engineer")
  assert.equal(brief.company, "Northwind")
  assert.equal(brief.location, "Austin, TX, US")
  assert.equal(brief.emails[0], "jobs@northwind.example")
  const draft = buildDraft(brief, { name: "", email: "" })
  assert.match(draft.subject, /Northwind/)
  assert.match(draft.body, /Hi Northwind team/)
})

test("rejects a login wall with no post body", () => {
  assert.throws(
    () => parseLinkedInHtml("<title>Sign in | LinkedIn</title><div class='authwall'></div>", "https://www.linkedin.com/jobs/view/9", "https://www.linkedin.com/jobs/view/9"),
    (error: unknown) => error instanceof IntakeError && error.code === "login_wall"
  )
})

test("extracts a recruiter blast without calling a model", () => {
  const description = [
    "Good Morning LinkedIn",
    "Urgently Hiring….Hiring",
    "Codeverse Weenggs Solution LLP is hiring for below position",
    "Node JS Developer",
    "Experience : 5+ year",
    "Share your resume at hr@weenggs.com or call 501-203 5079",
  ].join("\n")
  const facts = extractPostFacts({
    title: "Good Morning LinkedIn",
    description,
    authorName: "Ada Stone",
    kind: "post",
  })
  assert.equal(facts.company, "Codeverse Weenggs Solution LLP")
  assert.equal(facts.role, "Node JS Developer")
  assert.equal(facts.contactName, "Ada Stone")
  assert.equal(facts.postKind, "recruiter")
  assert.equal(facts.domain, "weenggs.com")
})

test("keeps an employer job and ignores linkedin links as a domain", () => {
  const facts = extractPostFacts({
    title: "Staff Engineer",
    description: "Build the intake pipeline. See https://www.linkedin.com/company/northwind",
    company: "Northwind",
    kind: "job",
  })
  assert.equal(facts.company, "Northwind")
  assert.equal(facts.role, "Staff Engineer")
  assert.equal(facts.postKind, "employer")
  assert.equal(facts.domain, "")
})

test("ignores linkedin system emails and keeps a real one", () => {
  assert.deepEqual(extractEmails("Write jobs@northwind.example not noise@linkedin.com"), [
    "jobs@northwind.example",
  ])
  assert.deepEqual(extractPhones("call 501-203 5079 today"), ["501-203 5079"])
})

test("only allows LinkedIn hosts", () => {
  assert.equal(assertLinkedInUrl("https://lnkd.in/abc").hostname, "lnkd.in")
  assert.throws(() => assertLinkedInUrl("https://example.com/jobs"), IntakeError)
  assert.throws(() => assertLinkedInUrl("not a url"), IntakeError)
})
