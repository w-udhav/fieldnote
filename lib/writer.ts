export type WriterDraft = {
  subject: string
  body: string
  company: string
  role: string
}

function cleanCompany(value: string) {
  const company = value.trim()
  if (!company) return ""
  if (/^(unknown|unknown company|n\/a|none)$/i.test(company)) return ""
  return company.slice(0, 200)
}

function cleanRole(value: string) {
  const role = value.trim()
  if (!role) return ""
  if (/^(unknown|unknown role|n\/a|none|general)$/i.test(role)) return ""
  return role.slice(0, 180)
}

export function parseModelJson(raw: string): WriterDraft {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("The model did not return JSON.")
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    subject?: unknown
    body?: unknown
    company?: unknown
    role?: unknown
  }
  const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : ""
  const body = typeof parsed.body === "string" ? parsed.body.trim() : ""
  const company = typeof parsed.company === "string" ? cleanCompany(parsed.company) : ""
  const role = typeof parsed.role === "string" ? cleanRole(parsed.role) : ""
  if (!subject || !body) throw new Error("The model JSON needs subject and body.")
  return { subject: subject.slice(0, 180), body: body.slice(0, 4000), company, role }
}

const FEW_SHOTS = `EXAMPLES
These show shape only. Do not copy their names, companies, or projects. Use CANDIDATE PROFILE for the real name, work, and links.

Example 1
{"subject":"Backend role at Harbor Ledger","body":"Hi Mina,\\n\\nHarbor Ledger's note on cutting invoice exceptions stood out. That is the kind of unglamorous product work I like.\\n\\nI built a small billing worker that sends receipts and retries the failures, and I have been living in that code for the last year.\\n\\nIf you are still hiring for the backend role, I would be glad to talk for 15 minutes.\\n\\nThanks,\\nSam Example\\nhttps://example.com","company":"Harbor Ledger","role":"Backend engineer"}

Example 2
{"subject":"Question about Northwind hiring","body":"Hi Jon,\\n\\nI have been using Northwind's public status page while it was down last week, and the write-up of what broke was unusually clear.\\n\\nThe closest thing I have shipped is an internal tool that pages the on-call person when a job stalls.\\n\\nAre you open to a short chat about the platform role, or is hiring closed for now?\\n\\nThanks,\\nSam Example\\nhttps://example.com","company":"Northwind","role":"Platform engineer"}`

export function resolveWriterSystem(custom?: string) {
  const text = custom?.replace(/\r\n/g, "\n").trim()
  return text || writerSystem()
}

export function writerSystem() {
  return [
    "You write cold outreach emails for a software engineer applying for jobs.",
    "",
    "GOAL",
    "Write a short, genuine email to a founder or hiring manager that earns a reply.",
    "The reader is busy and gets many emails. Make it easy to say yes.",
    "",
    "RULES",
    "- Length: 80-120 words in the body. Never exceed 130.",
    "- Use ONLY facts from CANDIDATE PROFILE and COMPANY CONTEXT. Never invent projects, metrics, skills, employers, or details about the company.",
    "- If COMPANY CONTEXT is thin, keep the personalization line general rather than guessing.",
    "- Structure: (1) one specific line about the company, (2) one or two lines on the single most relevant thing the candidate has built, (3) one small, low-pressure ask, (4) sign-off with the name and links from the profile.",
    "- Tone: professional, warm, direct, and human. Plain English.",
    '- Banned phrases: "I hope this email finds you well", "I am passionate about", "I am writing to express my interest", "esteemed", "leverage", "synergy", "rockstar", "ninja", "dear sir/madam".',
    "- No flattery beyond one genuine, specific observation. No exclamation marks. No emojis. No buzzword lists of technologies.",
    "- Ask should be small: whether they are hiring for a relevant role, or whether they would be open to a 15-minute chat. Never demand anything.",
    "- Subject line: under 8 words, specific, no clickbait, no ALL CAPS.",
    "- Do not mention that the email was AI-generated.",
    "- role is the job title stated in the job text. If the current title is a greeting or not a role, replace it. Use an empty string when the text names no role.",
    "- company is the hiring organization named in the job text, even when COMPANY CONTEXT says Unknown. Use an empty string only when the text never names one. Do not put company in the email body as a label.",
    "",
    "OUTPUT FORMAT",
    "Return only valid JSON, nothing else:",
    '{"subject":"...","body":"...","company":"...","role":"..."}',
    "Use \\n for line breaks inside body.",
    "",
    FEW_SHOTS,
  ].join("\n")
}

export function writerPrompt(input: {
  profile: string
  title: string
  company: string
  authorName: string
  url: string
  description: string
}) {
  const hook = input.description.trim() || "No job text was on the public page. Keep the company line general."
  return [
    "CANDIDATE PROFILE",
    input.profile.trim() || "No profile was provided. Keep the candidate lines general and do not invent a background.",
    "",
    "COMPANY CONTEXT",
    `Company: ${input.company.trim() || "Unknown"}`,
    `Contact: ${input.authorName.trim() || "Unknown"}`,
    `Role of interest: ${input.title.trim() || "General"}`,
    `URL: ${input.url.trim()}`,
    "Specific hook:",
    hook,
    "",
    "Write the email.",
  ].join("\n")
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
