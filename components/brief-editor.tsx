"use client"

import { useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { ApiError, api } from "@/lib/client"
import type { BriefRecord, EmailDraft, PublicSettings } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

function formatWhen(value: string | null) {
  if (!value) return "Not listed"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function destinationLabel(status: BriefRecord["destinations"]["notion"]["status"]) {
  if (status === "filed") return "Filed"
  if (status === "failed") return "Failed"
  return "Not connected"
}

export function BriefEditor({
  record,
  onChange,
}: {
  record: BriefRecord
  onChange: (record: BriefRecord) => void
}) {
  const [draft, setDraft] = useState<EmailDraft>(record.draft)
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    void api<{ settings: PublicSettings }>("/api/settings")
      .then((data) => setSettings(data.settings))
      .catch(() => setSettings(null))
  }, [])

  function update(partial: Partial<EmailDraft>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  async function saveDraft() {
    setSaving(true)
    try {
      const data = await api<{ record: BriefRecord }>(`/api/records/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({ draft }),
      })
      onChange(data.record)
      toast.success("Draft saved in the pipeline.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the draft.")
    } finally {
      setSaving(false)
    }
  }

  async function send() {
    setSending(true)
    try {
      const data = await api<{ record: BriefRecord }>(`/api/records/${record.id}/send`, {
        method: "POST",
        body: JSON.stringify({ draft }),
      })
      onChange(data.record)
      setDraft(data.record.draft)
      toast.success(`Sent to ${data.record.draft.to}.`)
    } catch (error) {
      if (error instanceof ApiError && error.record) onChange(error.record)
      toast.error(error instanceof Error ? error.message : "Mail was not sent.")
    } finally {
      setSending(false)
    }
  }

  const mailto = `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
  const smtpReady = settings?.smtpConfigured ?? false

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{record.kind === "job" ? "Job" : record.kind === "post" ? "Post" : "Page"}</Badge>
            <Badge variant={record.status === "sent" ? "default" : record.status === "send_failed" ? "destructive" : "outline"}>
              {record.status === "send_failed" ? "Send failed" : record.status === "sent" ? "Sent" : "Filed"}
            </Badge>
          </div>
          <CardTitle className="font-heading text-2xl leading-tight">{record.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {[record.company, record.location, record.employmentType].filter(Boolean).join(" · ") || "No company or location on the public page."}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Author</dt>
              <dd>
                {record.authorUrl ? (
                  <a className="underline decoration-border underline-offset-4" href={record.authorUrl} target="_blank" rel="noreferrer">
                    {record.authorName || "Profile"}
                  </a>
                ) : (
                  record.authorName || "Not listed"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Posted</dt>
              <dd>{formatWhen(record.publishedAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {record.emails.length ? (
                  record.emails.map((email) => (
                    <button
                      key={email}
                      type="button"
                      className="rounded-full bg-secondary px-2 py-0.5 text-left text-xs"
                      onClick={() => update({ to: email })}
                    >
                      {email}
                    </button>
                  ))
                ) : (
                  <span>None on the public page</span>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{record.phones.length ? record.phones.join(", ") : "None on the public page"}</dd>
            </div>
          </dl>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Filed to</p>
            <ul className="flex flex-col gap-1 text-sm">
              <li>Local pipeline: Filed</li>
              <li>
                Notion: {destinationLabel(record.destinations.notion.status)}
                {record.destinations.notion.url ? (
                  <>
                    {" "}
                    <a className="underline decoration-border underline-offset-4" href={record.destinations.notion.url} target="_blank" rel="noreferrer">
                      Open page
                    </a>
                  </>
                ) : null}
                {record.destinations.notion.detail && record.destinations.notion.status !== "filed" ? (
                  <span className="block text-muted-foreground">{record.destinations.notion.detail}</span>
                ) : null}
              </li>
              <li>
                Google Sheet: {destinationLabel(record.destinations.sheets.status)}
                {record.destinations.sheets.detail && record.destinations.sheets.status !== "filed" ? (
                  <span className="block text-muted-foreground">{record.destinations.sheets.detail}</span>
                ) : null}
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Page text</p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/70 p-3 text-sm leading-6">
              {record.description || "No description."}
            </pre>
          </div>
          <a className="text-sm underline decoration-border underline-offset-4" href={record.finalUrl} target="_blank" rel="noreferrer">
            Open the LinkedIn page
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Mail draft</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nothing is sent until you press Send. Edit the note first.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mail-to">To</Label>
            <Input
              id="mail-to"
              value={draft.to}
              onChange={(event) => update({ to: event.target.value })}
              placeholder="name@company.com"
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mail-subject">Subject</Label>
            <Input
              id="mail-subject"
              value={draft.subject}
              onChange={(event) => update({ subject: event.target.value })}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mail-body">Message</Label>
            <Textarea
              id="mail-body"
              value={draft.body}
              onChange={(event) => update({ body: event.target.value })}
              className="min-h-72 font-sans text-sm leading-6"
            />
          </div>
          {record.sendError && record.status !== "sent" ? (
            <p className="text-sm text-destructive">{record.sendError}</p>
          ) : null}
          {record.sentAt ? (
            <p className="text-sm text-muted-foreground">Sent {formatWhen(record.sentAt)}.</p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={() => void saveDraft()} disabled={saving || sending}>
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            Save draft
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a className={cn(buttonVariants({ variant: "secondary" }), "h-8")} href={mailto}>
              Open in mail app
            </a>
            <Button type="button" onClick={() => void send()} disabled={sending || saving || !smtpReady}>
              {sending ? <Loader2Icon className="animate-spin" /> : null}
              Send mail
            </Button>
          </div>
          {!smtpReady ? (
            <p className="w-full text-sm text-muted-foreground sm:order-last">
              Connect SMTP in Settings to send from here. Open in mail app still works.
            </p>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  )
}
