import nodemailer from "nodemailer"
import type { EmailDraft, Settings } from "./types"

export type MailAttachment = {
  filename: string
  path: string
}

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

export function assertDraft(draft: EmailDraft) {
  if (!draft.to.trim() || !EMAIL_RE.test(draft.to.trim())) {
    throw new Error("Add a valid recipient email before sending.")
  }
  if (!draft.subject.trim()) throw new Error("Add a subject before sending.")
  if (!draft.body.trim()) throw new Error("Write a message before sending.")
}

export function mailTransport(settings: Settings) {
  if (!settings.smtpHost || !settings.senderEmail) {
    throw new Error("Add an SMTP host and a from address in Settings.")
  }
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: settings.smtpUser
      ? { user: settings.smtpUser, pass: settings.smtpPass }
      : undefined,
  })
}

export async function verifyMail(settings: Settings) {
  const transport = mailTransport(settings)
  await transport.verify()
}

export async function sendMail(
  settings: Settings,
  draft: EmailDraft,
  options?: { attachments?: MailAttachment[] }
) {
  assertDraft(draft)
  const transport = mailTransport(settings)
  const from = settings.senderName
    ? `"${settings.senderName.replace(/"/g, "")}" <${settings.senderEmail}>`
    : settings.senderEmail
  const info = await transport.sendMail({
    from,
    to: draft.to.trim(),
    replyTo: settings.senderEmail,
    subject: draft.subject.trim(),
    text: draft.body,
    attachments: options?.attachments,
  })
  const messageId = info.messageId?.trim()
  if (!messageId) throw new Error("Mail was sent but no Message-ID was returned.")
  return messageId
}
