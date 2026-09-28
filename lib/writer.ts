export type WriterDraft = {
  subject: string
  body: string
  company: string
}

function cleanCompany(value: string) {
  const company = value.trim()
  if (!company) return ""
  if (/^(unknown|unknown company|n\/a|none)$/i.test(company)) return ""
  return company.slice(0, 200)
}

export function parseModelJson(raw: string): WriterDraft {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("The model did not return JSON.")
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    subject?: unknown
    body?: unknown
    company?: unknown
  }
  const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : ""
  const body = typeof parsed.body === "string" ? parsed.body.trim() : ""
  const company = typeof parsed.company === "string" ? cleanCompany(parsed.company) : ""
  if (!subject || !body) throw new Error("The model JSON needs subject and body.")
  return { subject: subject.slice(0, 180), body: body.slice(0, 4000), company }
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

export function writerSystem(sender: { name: string; email: string }) {
  const name = sender.name.trim() || "the applicant"
  const email = sender.email.trim()
  return [
    "You write a professional outreach email for a job the user wants to apply to.",
    'Reply with JSON only: {"subject":"...","body":"...","company":"..."}.',
    "The body is plain text, about 90 to 160 words, specific to the role and the company named in the job text.",
    "Open with the poster's first name when one is given.",
    `Sign off with ${name}.${email ? ` The sender email is ${email}.` : ""}`,
    "company is the hiring organization exactly as written in the job text. Use an empty string when the text does not name one.",
    "Do not invent an employer, metric, job title, email address, phone number, or any fact that is not in the job text.",
    "Do not mention that you are an AI.",
  ].join(" ")
}

export function llmChatRequest(input: { model?: string; system: string; user: string }) {
  const body: Record<string, unknown> = {
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    temperature: 0.4,
    max_tokens: 700,
    stream: false,
    response_format: { type: "json_object" },
    chat_template_kwargs: { enable_thinking: false },
  }
  const model = input.model?.trim()
  if (model) body.model = model
  return body
}

export function llmBaseUrl() {
  return (process.env.LLM_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "")
}

export async function requestWriterDraft(input: { system: string; user: string }): Promise<WriterDraft> {
  const response = await fetch(`${llmBaseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      llmChatRequest({
        model: process.env.LLM_MODEL,
        system: input.system,
        user: input.user,
      })
    ),
    signal: AbortSignal.timeout(180000),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text.slice(0, 280) || `The model returned ${response.status}.`)
  }
  const json = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[]
  }
  return parseModelJson(json.choices?.[0]?.message?.content ?? "")
}
