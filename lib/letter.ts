import type { JobCategory } from "./job-categories"

export const PORTFOLIO_URL = "https://www.udhv.space/"

export type ValueBeat = "wait" | "message" | "screen"

const VALUE: Record<ValueBeat, string> = {
  wait: "I work on the part of a product a person actually feels: the request that makes them wait, and I make that path something people can rely on.",
  message:
    "I work on the part of a product a person actually feels: the message that has to leave and arrive, and I make that path something people can rely on.",
  screen:
    "I work on the part of a product a person actually feels: the screen that should show the work, not a spinner.",
}

const CATEGORY_VALUE: Partial<Record<JobCategory, string>> = {
  "Full-stack":
    "I work across a product path end to end, connecting the interface, the service behind it, and the data it depends on so the whole experience remains reliable.",
  Frontend:
    "I build interfaces around the work a person is trying to finish, keeping the screen clear, responsive, and dependable.",
  Backend:
    "I build backend paths that stay understandable under change and make requests, data, and failures easier to rely on.",
  Python:
    "I use Python to turn product requirements into clear services and dependable workflows that are straightforward to operate.",
  "JavaScript / TypeScript":
    "I build product flows with JavaScript and TypeScript while keeping the boundaries between the interface and its services clear.",
  "Node.js":
    "I build Node.js services around predictable request handling, background work, and integrations that need to keep moving.",
  Java:
    "I build service paths with an emphasis on clear boundaries, predictable behavior, and code that remains workable as the product grows.",
  ".NET":
    "I build service paths with an emphasis on clear boundaries, predictable behavior, and code that remains workable as the product grows.",
  PHP:
    "I build web product paths that connect business rules, data, and the user-facing experience without making the system harder to change.",
  Mobile:
    "I focus on mobile experiences that remain responsive and make network, state, and failure handling feel simple to the person using them.",
  "DevOps / Cloud":
    "I work on the delivery path around a product so releases, infrastructure, and recovery are dependable instead of surprising.",
  "Data / AI":
    "I build data paths that make inputs, processing, and outputs traceable enough for a team to trust and improve.",
  "QA / Test":
    "I turn important product paths into repeatable checks so teams can change the product without guessing what they broke.",
  Security:
    "I approach product security as part of the path itself, making boundaries and failure modes explicit before they become incidents.",
}

export function valueBeat(text: string): ValueBeat {
  const value = text.toLowerCase()
  if (/\b(front\s*end|frontend|ui|ux|design|react|css|screen)\b/.test(value)) return "screen"
  if (/\b(mail|email|smtp|message|notif|notification|queue|kafka|inbox|sms)\b/.test(value)) {
    return "message"
  }
  return "wait"
}

export function categoryValue(categories: JobCategory[] = [], text = "") {
  for (const category of categories) {
    const value = CATEGORY_VALUE[category]
    if (value) return value
  }
  return VALUE[valueBeat(text)]
}

function firstName(name: string) {
  const token = name.replace(/[’']/g, "'").trim().split(/\s+/)[0] ?? ""
  if (!token || token.length < 2 || /[#@]/.test(token)) return ""
  return token
}

export function companySentence(input: {
  company: string
  hook: string
  whatTheyDo: string
  sourceUrl: string
}) {
  if (!input.sourceUrl.trim()) return ""
  const fact = (input.hook || input.whatTheyDo).replace(/\s+/g, " ").trim()
  if (!fact || /urgently hiring|i see you/i.test(fact)) return ""
  const company = input.company.replace(/\s+/g, " ").trim()
  const body = fact.replace(/\.+$/, "")
  const namesCompany = company && body.toLowerCase().includes(company.toLowerCase())
  const sentence = namesCompany
    ? body
    : company
      ? `${company} ${body.charAt(0).toLowerCase()}${body.slice(1)}`
      : body
  return `I read that ${sentence}.`
}

export function renderLetter(input: {
  contactName: string
  company: string
  role: string
  hook: string
  whatTheyDo: string
  sourceUrl: string
  categories?: JobCategory[]
  senderName?: string
}) {
  const contact = firstName(input.contactName)
  const company = input.company.replace(/\s+/g, " ").trim()
  const role = input.role.replace(/\s+/g, " ").trim()
  const greeting = contact ? `Hi ${contact},` : company ? `Hi ${company} team,` : "Hello,"
  const about = companySentence(input)
  const ask = role
    ? `If you are still hiring for the ${role}, I would be glad to talk for 15 minutes.`
    : "If you are still hiring, I would be glad to talk for 15 minutes."
  const name = input.senderName?.trim() || "Udhav Wadhawan"
  const subject = (role && company ? `${role} — ${company}` : role || company || "Hello").slice(0, 120)
  const body = [
    greeting,
    "",
    ...(about ? [about, ""] : []),
    categoryValue(input.categories, `${role}\n${input.whatTheyDo}`),
    "",
    ask,
    "",
    "Thanks,",
    name,
    PORTFOLIO_URL,
  ].join("\n")
  return { subject, body }
}
