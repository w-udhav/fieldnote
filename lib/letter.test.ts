import assert from "node:assert/strict"
import test from "node:test"
import { companySentence, renderLetter, valueBeat } from "./letter"

test("value beat follows the role and stays free of employers and numbers", () => {
  assert.equal(valueBeat("Node JS Developer"), "wait")
  assert.equal(valueBeat("React frontend"), "screen")
  assert.equal(valueBeat("email deliverability"), "message")
  const letter = renderLetter({
    contactName: "Ada Stone",
    company: "Northwind",
    role: "Node JS Developer",
    hook: "",
    whatTheyDo: "",
    sourceUrl: "",
    senderName: "Udhav Wadhawan",
  })
  assert.match(letter.body, /^Hi Ada,/)
  assert.doesNotMatch(letter.body, /I read that/)
  assert.doesNotMatch(letter.body, /urgently hiring|Wendor|Orbitaim|15 seconds|\d+%/i)
  assert.match(letter.body, /request that makes them wait/)
  assert.match(letter.body, /If you are still hiring for the Node JS Developer/)
  assert.match(letter.body, /Udhav Wadhawan\nhttps:\/\/www\.udhv\.space\//)
})

test("company sentence is used only when a source URL exists", () => {
  assert.equal(
    companySentence({
      company: "Northwind",
      hook: "builds intake software for shippers",
      whatTheyDo: "",
      sourceUrl: "",
    }),
    ""
  )
  const letter = renderLetter({
    contactName: "",
    company: "Northwind",
    role: "Staff Engineer",
    hook: "builds intake software for shippers",
    whatTheyDo: "moves freight",
    sourceUrl: "https://northwind.example/about",
  })
  assert.match(letter.body, /Hi Northwind team,/)
  assert.match(letter.body, /I read that Northwind builds intake software for shippers\./)
  assert.doesNotMatch(letter.body, /urgently hiring/)
})

test("uses a fixed category cover paragraph instead of generated copy", () => {
  const letter = renderLetter({
    contactName: "Ada",
    company: "Northwind",
    role: "Python Full Stack Developer",
    categories: ["Full-stack", "Python"],
    hook: "",
    whatTheyDo: "",
    sourceUrl: "",
  })
  assert.match(letter.body, /across a product path end to end/)
  assert.doesNotMatch(letter.body, /request that makes them wait/)
})
