"use client"

import { useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/client"
import type { PublicSettings } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  notionDatabaseId: "",
  notionConfigured: false,
  sheetsWebhookUrl: "",
  sheetsConfigured: false,
  lockRequired: false,
  smtpPass: "",
  notionToken: "",
}

export function SettingsForm() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState<string | null>(null)
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
          notionToken: form.notionToken,
          notionDatabaseId: form.notionDatabaseId,
          sheetsWebhookUrl: form.sheetsWebhookUrl,
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

  if (loading) return <p className="text-sm text-muted-foreground">Loading settings…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-4xl tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          The local pipeline works with nothing connected. Notion, Google Sheets, and SMTP are
          optional. Mail leaves this desk only when you press Send on a brief.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mail</CardTitle>
          <CardDescription>
            {form.smtpConfigured
              ? "SMTP is connected. Send on a brief will deliver from this address."
              : "Not connected. Drafts can still open in your mail app."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sender-name">Your name</Label>
            <Input id="sender-name" className="h-10" value={form.senderName} onChange={(event) => set("senderName", event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sender-email">From address</Label>
            <Input id="sender-email" className="h-10" type="email" value={form.senderEmail} onChange={(event) => set("senderEmail", event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtp-host">SMTP host</Label>
            <Input id="smtp-host" className="h-10" value={form.smtpHost} onChange={(event) => set("smtpHost", event.target.value)} placeholder="smtp.gmail.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtp-port">Port</Label>
            <Input id="smtp-port" className="h-10" type="number" value={form.smtpPort} onChange={(event) => set("smtpPort", Number(event.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtp-user">SMTP username</Label>
            <Input id="smtp-user" className="h-10" value={form.smtpUser} onChange={(event) => set("smtpUser", event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="smtp-pass">SMTP password</Label>
            <Input id="smtp-pass" className="h-10" type="password" value={form.smtpPass} onChange={(event) => set("smtpPass", event.target.value)} placeholder={form.smtpConfigured ? "Saved. Leave blank to keep it." : "App password"} autoComplete="new-password" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.smtpSecure} onChange={(event) => set("smtpSecure", event.target.checked)} />
            Use implicit TLS (typical for port 465)
          </label>
          <Button type="button" variant="outline" disabled={checking !== null} onClick={() => void check("smtp")}>
            {checking === "smtp" ? <Loader2Icon className="animate-spin" /> : null}
            Check SMTP
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notion</CardTitle>
          <CardDescription>
            {form.notionConfigured
              ? "New briefs are added to this database."
              : "Not connected. Create an integration, share a database with it, and paste the token and database ID."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notion-token">Integration token</Label>
            <Input id="notion-token" className="h-10" type="password" value={form.notionToken} onChange={(event) => set("notionToken", event.target.value)} placeholder={form.notionConfigured ? "Saved. Leave blank to keep it." : "ntn_…"} autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notion-db">Database ID or URL</Label>
            <Input id="notion-db" className="h-10" value={form.notionDatabaseId} onChange={(event) => set("notionDatabaseId", event.target.value)} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            A title property is enough. If the database also has Email, Phone, URL, Company,
            Location, Author, Status, or Kind, those get filled when the names match.
          </p>
          <Button type="button" variant="outline" disabled={checking !== null} onClick={() => void check("notion")}>
            {checking === "notion" ? <Loader2Icon className="animate-spin" /> : null}
            Check Notion
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Google Sheet</CardTitle>
          <CardDescription>
            {form.sheetsConfigured
              ? "Briefs are appended, and later sends update the same row."
              : "Not connected. Deploy the Apps Script in integrations/google-apps-script.js as a web app."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sheet-url">Apps Script web app URL</Label>
            <Input id="sheet-url" className="h-10" value={form.sheetsWebhookUrl} onChange={(event) => set("sheetsWebhookUrl", event.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          </div>
          <Button type="button" variant="outline" disabled={checking !== null} onClick={() => void check("sheets")}>
            {checking === "sheets" ? <Loader2Icon className="animate-spin" /> : null}
            Check sheet
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" className="h-10 px-4" disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : null}
          Save settings
        </Button>
        <p className="text-sm text-muted-foreground">Passwords stay on this machine and are not shown again.</p>
      </div>
    </form>
  )
}
