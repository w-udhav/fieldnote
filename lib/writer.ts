export function parseModelJson(raw: string) {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("The model did not return JSON.")
  const parsed = JSON.parse(raw.slice(start, end + 1)) as { subject?: unknown; body?: unknown }
  const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : ""
  const body = typeof parsed.body === "string" ? parsed.body.trim() : ""
  if (!subject || !body) throw new Error("The model JSON needs subject and body.")
  return { subject: subject.slice(0, 180), body: body.slice(0, 4000) }
}

export function writerPrompt(input: {
  title: string
  company: string
  authorName: string
  url: string
  description: string
}) {
  return [
    `Role: ${input.title || "Unknown role"}`,
    `Company: ${input.company || "Unknown company"}`,
    `Poster: ${input.authorName || "Unknown"}`,
    `URL: ${input.url || ""}`,
    "",
    "Job text:",
    input.description || "No description was on the public page.",
  ].join("\n")
}

export const WRITER_SYSTEM = [
  "You write a short outreach email for a job the user wants to apply to.",
  "Reply with JSON only: {\"subject\":\"...\",\"body\":\"...\"}.",
  "The body is plain text, under 180 words, specific to the role and company.",
  "Do not invent an email address, phone number, or a fact that is not in the job text.",
  "Do not mention that you are an AI.",
].join(" ")
