"use client"

import { useEffect, useState, type CSSProperties } from "react"
import {
  DatabaseIcon,
  FileTextIcon,
  InboxIcon,
  Loader2Icon,
  MailIcon,
  SheetIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/client"
import type { PublicSettings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"

type FormState = PublicSettings & {
  smtpPass: string
  notionToken: string
}

const EMPTY: FormState = {
  senderName: "",
  senderEmail: "",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpConfigured: false,
  imapHost: "imap.gmail.com",
  imapPort: 993,
  imapSecure: true,
  imapConfigured: false,
  resumePath: "data/resume.pdf",
  resumeConfigured: false,
  notionDatabaseId: "",
  notionConfigured: false,
  sheetsWebhookUrl: "",
  sheetsConfigured: false,
  lockRequired: false,
  writerSystemPrompt: "",
  writerProfile: "",
  writerSystemDefault: "",
  writerProfileDefault: "",
  smtpPass: "",
  notionToken: "",
}

const TABS = [
  { id: "mail", label: "Mail", icon: MailIcon },
  { id: "resume", label: "Resume", icon: FileTextIcon },
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "notion", label: "Notion", icon: DatabaseIcon },
  { id: "sheet", label: "Sheet", icon: SheetIcon },
  { id: "prompt", label: "Prompt", icon: SparklesIcon },
] as const

type TabId = (typeof TABS)[number]["id"]

function Field({
  id,
  label,
  children,
  className,
}: {
  id: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export function SettingsForm() {
  const [tab, setTab] = useState<TabId>("mail")
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState<string | null>(null)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    void api<{ settings: PublicSettings }>("/api/settings")
      .then((data) => setForm((current) => ({ ...current, ...data.settings, smtpPass: "", notionToken: "" })))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Could not load settings.")
      })
      .finally(() => setLoading(false))
  }, [])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const data = await api<{ settings: PublicSettings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          senderName: form.senderName,
          senderEmail: form.senderEmail,
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort),
          smtpSecure: form.smtpSecure,
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          imapHost: form.imapHost,
          imapPort: Number(form.imapPort),
          imapSecure: form.imapSecure,
          notionToken: form.notionToken,
          notionDatabaseId: form.notionDatabaseId,
          sheetsWebhookUrl: form.sheetsWebhookUrl,
          writerSystemPrompt: form.writerSystemPrompt,
          writerProfile: form.writerProfile,
        }),
      })
      setForm((current) => ({ ...current, ...data.settings, smtpPass: "", notionToken: "" }))
      toast.success("Settings saved on this machine.")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  async function uploadResume(file: File) {
    setUploadingResume(true)
    try {
      const body = new FormData()
      body.append("resume", file)
      const key = window.sessionStorage.getItem("fieldnote-key") ?? ""
      const response = await fetch("/api/settings/resume", {
        method: "POST",
        body,
        headers: key ? { "x-fieldnote-key": key } : {},
      })
      const data = (await response.json()) as { settings?: PublicSettings; error?: string }
      if (!response.ok) throw new Error(data.error || "Upload failed.")
      if (data.settings) setForm((current) => ({ ...current, ...data.settings }))
      toast.success("Resume saved.")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not upload the resume.")
    } finally {
      setUploadingResume(false)
    }
  }

  async function resetNotionColumns() {
    const confirmed = window.confirm(
      "Replace every column in this Notion database? Values stored in those columns are removed. The title column stays and is renamed to Role."
    )
    if (!confirmed) return
    setChecking("notion-schema")
    try {
      const data = await api<{ detail: string }>("/api/notion/schema", {
        method: "POST",
        body: JSON.stringify({
          notionToken: form.notionToken,
          notionDatabaseId: form.notionDatabaseId,
        }),
      })
      toast.success(data.detail)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not replace the Notion columns.")
    } finally {
      setChecking(null)
    }
  }

  async function check(target: "smtp" | "notion" | "sheets") {
    setChecking(target)
    try {
      const data = await api<{ detail: string }>("/api/settings/check", {
        method: "POST",
        body: JSON.stringify({ target }),
      })
      toast.success(data.detail)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Check failed.")
    } finally {
      setChecking(null)
    }
  }

  const descriptions: Record<TabId, string> = {
    mail: form.smtpConfigured
      ? "SMTP is connected. Send on a brief delivers from this address."
      : "Gmail: smtp.gmail.com, port 587, implicit TLS off, and an app password.",
    resume: form.resumeConfigured ? "This PDF attaches when you press Send." : "Upload a PDF. It attaches on Send.",
    inbox: form.imapConfigured
      ? "Reply snippets sync from this mailbox."
      : "Uses the same Gmail address and app password as SMTP.",
    notion: form.notionConfigured
      ? "New briefs are written to this database."
      : "Share a database with your integration, then paste the token and ID.",
    sheet: form.sheetsConfigured
      ? "Optional copy. Sends update the row with the same record id."
      : "Optional. Deploy integrations/google-apps-script.js as a web app.",
    prompt: "Rewrite and the worker use this text. Saving the built-in wording keeps the default.",
  }
  const current = TABS.find((item) => item.id === tab) ?? TABS[0]

  return (
    <form onSubmit={save} className="flex h-full min-h-0">
      <SidebarProvider className="h-full min-h-0" style={{ "--sidebar-width": "13rem" } as CSSProperties}>
        <Sidebar collapsible="none" className="h-full border-r border-sidebar-border">
          <SidebarHeader>
            <DialogTitle className="px-2 text-sm">Settings</DialogTitle>
            <DialogDescription className="sr-only">
              Mail, resume, inbox, Notion, Google Sheet, and the writer prompt. Secrets stay on this machine.
            </DialogDescription>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {TABS.map((item) => {
                    const Icon = item.icon
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton type="button" isActive={tab === item.id} onClick={() => setTab(item.id)}>
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="min-h-0 overflow-hidden bg-transparent">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 px-6 py-4 pr-12">
          <h2 className="text-base font-semibold">{current.label}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{descriptions[tab]}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {loading ? <p className="text-sm text-muted-foreground">Loading settings…</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && !error && tab === "mail" ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="sender-name" label="Your name">
                  <Input id="sender-name" className="h-9" value={form.senderName} onChange={(event) => set("senderName", event.target.value)} />
                </Field>
                <Field id="sender-email" label="From address">
                  <Input id="sender-email" className="h-9" type="email" value={form.senderEmail} onChange={(event) => set("senderEmail", event.target.value)} />
                </Field>
                <Field id="smtp-host" label="SMTP host">
                  <Input id="smtp-host" className="h-9" value={form.smtpHost} onChange={(event) => set("smtpHost", event.target.value)} placeholder="smtp.gmail.com" />
                </Field>
                <Field id="smtp-port" label="Port">
                  <Input id="smtp-port" className="h-9" type="number" value={form.smtpPort} onChange={(event) => set("smtpPort", Number(event.target.value))} />
                </Field>
                <Field id="smtp-user" label="Username">
                  <Input id="smtp-user" className="h-9" value={form.smtpUser} onChange={(event) => set("smtpUser", event.target.value)} />
                </Field>
                <Field id="smtp-pass" label="App password">
                  <Input id="smtp-pass" className="h-9" type="password" value={form.smtpPass} onChange={(event) => set("smtpPass", event.target.value)} placeholder={form.smtpConfigured ? "Saved. Leave blank to keep it." : "App password"} autoComplete="new-password" />
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={form.smtpSecure} onChange={(event) => set("smtpSecure", event.target.checked)} />
                  Implicit TLS (port 465)
                </label>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-fit" disabled={checking !== null} onClick={() => void check("smtp")}>
                {checking === "smtp" ? <Loader2Icon className="animate-spin" /> : null}
                Check SMTP
              </Button>
            </div>
          ) : null}

          {!loading && !error && tab === "resume" ? (
            <div>
            <Field id="resume-file" label="Resume PDF">
              <Input
                id="resume-file"
                className="h-9"
                type="file"
                accept="application/pdf,.pdf"
                disabled={uploadingResume}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadResume(file)
                }}
              />
            </Field>
            </div>
          ) : null}

          {!loading && !error && tab === "inbox" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="imap-host" label="IMAP host">
                <Input id="imap-host" className="h-9" value={form.imapHost} onChange={(event) => set("imapHost", event.target.value)} placeholder="imap.gmail.com" />
              </Field>
              <Field id="imap-port" label="Port">
                <Input id="imap-port" className="h-9" type="number" value={form.imapPort} onChange={(event) => set("imapPort", Number(event.target.value))} />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.imapSecure} onChange={(event) => set("imapSecure", event.target.checked)} />
                TLS (port 993)
              </label>
            </div>
          ) : null}

          {!loading && !error && tab === "notion" ? (
            <div className="flex flex-col gap-4">
              <Field id="notion-token" label="Integration token">
                <Input id="notion-token" className="h-9" type="password" value={form.notionToken} onChange={(event) => set("notionToken", event.target.value)} placeholder={form.notionConfigured ? "Saved. Leave blank to keep it." : "ntn_…"} autoComplete="new-password" />
              </Field>
              <Field id="notion-db" label="Database ID or URL">
                <Input id="notion-db" className="h-9" value={form.notionDatabaseId} onChange={(event) => set("notionDatabaseId", event.target.value)} />
              </Field>
              <p className="text-sm leading-6 text-muted-foreground">
                Create columns replaces the database schema with the Fieldnote columns and removes the previous ones.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={checking !== null} onClick={() => void check("notion")}>
                  {checking === "notion" ? <Loader2Icon className="animate-spin" /> : null}
                  Check Notion
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={checking !== null} onClick={() => void resetNotionColumns()}>
                  {checking === "notion-schema" ? <Loader2Icon className="animate-spin" /> : null}
                  Create columns
                </Button>
              </div>
            </div>
          ) : null}

          {!loading && !error && tab === "sheet" ? (
            <div className="flex flex-col gap-4">
              <Field id="sheet-url" label="Apps Script web app URL">
                <Input id="sheet-url" className="h-9" value={form.sheetsWebhookUrl} onChange={(event) => set("sheetsWebhookUrl", event.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
              </Field>
              <Button type="button" variant="outline" size="sm" className="w-fit" disabled={checking !== null} onClick={() => void check("sheets")}>
                {checking === "sheets" ? <Loader2Icon className="animate-spin" /> : null}
                Check sheet
              </Button>
            </div>
          ) : null}

          {!loading && !error && tab === "prompt" ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="writer-system">System prompt</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("writerSystemPrompt", form.writerSystemDefault)}>
                    Reset
                  </Button>
                </div>
                <Textarea
                  id="writer-system"
                  value={form.writerSystemPrompt}
                  onChange={(event) => set("writerSystemPrompt", event.target.value)}
                  className="min-h-56 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="writer-profile">Candidate profile</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("writerProfile", form.writerProfileDefault)}>
                    Reset
                  </Button>
                </div>
                <Textarea
                  id="writer-profile"
                  value={form.writerProfile}
                  onChange={(event) => set("writerProfile", event.target.value)}
                  className="min-h-40 font-mono text-xs"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/30 px-6 py-3">
          <p className="text-xs text-muted-foreground">Passwords stay on this machine.</p>
          <Button type="submit" disabled={saving || loading || Boolean(error)}>
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
        </SidebarInset>
      </SidebarProvider>
    </form>
  )
}
