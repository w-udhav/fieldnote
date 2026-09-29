export const PORTFOLIO_URL = "https://www.udhv.space/"

export type ValueBeat = "wait" | "message" | "screen"

const VALUE: Record<ValueBeat, string> = {
  wait: "I work on the part of a product a person actually feels: the request that makes them wait, and I make that path something people can rely on.",
  message:
    "I work on the part of a product a person actually feels: the message that has to leave and arrive, and I make that path something people can rely on.",
  screen:
    "I work on the part of a product a person actually feels: the screen that should show the work, not a spinner.",
}

export function valueBeat(text: string): ValueBeat {
  const value = text.toLowerCase()
  if (/\b(front\s*end|frontend|ui|ux|design|react|css|screen)\b/.test(value)) return "screen"
  if (/\b(mail|email|smtp|message|notif|notification|queue|kafka|inbox|sms)\b/.test(value)) {
    return "message"
  }
  return "wait"
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
    VALUE[valueBeat(`${role}\n${input.whatTheyDo}`)],
    "",
    ask,
    "",
    "Thanks,",
    name,
    PORTFOLIO_URL,
  ].join("\n")
  return { subject, body }
}
