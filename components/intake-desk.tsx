"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/client"
import type { BriefRecord } from "@/lib/types"
import { BriefEditor } from "@/components/brief-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function IntakeDesk() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [record, setRecord] = useState<BriefRecord | null>(null)
  const [reused, setReused] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      const data = await api<{ record: BriefRecord; reused: boolean }>("/api/intake", {
        method: "POST",
        body: JSON.stringify({ url }),
      })
      setRecord(data.record)
      setReused(data.reused)
      toast.success(data.reused ? "Updated the open brief for this link." : "Brief filed.")
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not read that link."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="max-w-3xl">
        <h1 className="font-heading text-4xl tracking-tight sm:text-5xl">Paste a public LinkedIn link</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Fieldnote reads the public page, pulls the role, company, and any email or phone written
          on it, then files a brief. The mail stays a draft until you press Send.
        </p>
      </section>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <Label htmlFor="linkedin-url">LinkedIn job or post URL</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="linkedin-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/… or https://lnkd.in/…"
            className="h-10"
            required
            inputMode="url"
            autoComplete="off"
          />
          <Button type="submit" className="h-10 px-4" disabled={loading}>
            {loading ? <Loader2Icon className="animate-spin" /> : null}
            {loading ? "Reading" : "Extract and file"}
          </Button>
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Public posts and job pages that LinkedIn shows without a login. This desk does not sign in.
          </p>
        )}
      </form>

      {!record && !loading ? (
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            ["1. Read", "One link at a time. Short links are followed back to LinkedIn."],
            ["2. File", "The brief lands in the local pipeline, and in Notion or a Google Sheet when those are connected."],
            ["3. Send", "You edit the draft, then Send uses SMTP. Until then it stays on the brief."],
          ].map(([title, copy]) => (
            <li key={title} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <p className="font-heading text-lg">{title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Reading the public page and filing the brief…</p>
      ) : null}

      {record ? (
        <div className="flex flex-col gap-3">
          {reused ? (
            <p className="text-sm text-muted-foreground">
              This link already had an unsent brief, so that record was updated.{" "}
              <Link className="underline decoration-border underline-offset-4" href="/pipeline">
                View the pipeline
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Filed locally.{" "}
              <Link className="underline decoration-border underline-offset-4" href={`/pipeline/${record.id}`}>
                Open this brief
              </Link>
            </p>
          )}
          <BriefEditor key={`${record.id}:${record.updatedAt}`} record={record} onChange={setRecord} />
        </div>
      ) : null}
    </div>
  )
}
