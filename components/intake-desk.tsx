"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/client"
import type { BriefRecord } from "@/lib/types"
import { BriefEditor } from "@/components/brief-editor"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

function parseUrls(raw: string) {
  return raw
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function IntakeDesk({
  embedded = false,
  onFiled,
}: {
  embedded?: boolean
  onFiled?: () => void
}) {
  const [url, setUrl] = useState("")
  const [bulk, setBulk] = useState("")
  const [bulkMode, setBulkMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [record, setRecord] = useState<BriefRecord | null>(null)
  const [reused, setReused] = useState(false)

  async function fileOne(link: string) {
    return api<{ record: BriefRecord; reused: boolean }>("/api/intake", {
      method: "POST",
      body: JSON.stringify({ url: link }),
    })
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      if (bulkMode) {
        const urls = parseUrls(bulk)
        if (!urls.length) {
          setError("Paste at least one LinkedIn URL.")
          return
        }
        let last: BriefRecord | null = null
        let anyReused = false
        for (const link of urls) {
          const data = await fileOne(link)
          last = data.record
          anyReused = anyReused || data.reused
        }
        setRecord(last)
        setReused(anyReused)
        onFiled?.()
        toast.success(`Filed ${urls.length} link${urls.length === 1 ? "" : "s"}.`)
        return
      }

      const data = await fileOne(url)
      setRecord(data.record)
      setReused(data.reused)
      onFiled?.()
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
      {embedded ? null : (
        <PageHeader
          title="Quick create"
          description="Paste public LinkedIn job or post links. Each one is filed to Notion and queued for the AI writer."
        />
      )}
      <Card className="border-border/60 bg-card/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Link</CardTitle>
          <CardDescription>One URL, or several — one per line.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={bulkMode ? "linkedin-bulk" : "linkedin-url"}>
                {bulkMode ? "One URL per line" : "Job or post URL"}
              </Label>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setBulkMode((current) => !current)}
              >
                {bulkMode ? "Single URL" : "Paste many"}
              </button>
            </div>
            {bulkMode ? (
              <Textarea
                id="linkedin-bulk"
                value={bulk}
                onChange={(event) => setBulk(event.target.value)}
                placeholder={"https://www.linkedin.com/jobs/view/…\nhttps://lnkd.in/…"}
                className="min-h-36 font-mono text-sm"
              />
            ) : (
              <Input
                id="linkedin-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/…"
                className="h-10"
                required={!bulkMode}
                inputMode="url"
                autoComplete="off"
              />
            )}
            <Button type="submit" className="w-fit" disabled={loading}>
              {loading ? <Loader2Icon className="animate-spin" /> : null}
              {loading ? "Reading…" : bulkMode ? "File all" : "Extract and file"}
            </Button>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Short links are followed. No LinkedIn login — only what the public page shows.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Reading and filing…</p> : null}

      {record ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {reused ? "Updated existing brief." : "New brief filed."}{" "}
            <Link className="underline underline-offset-4" href="/pipeline">
              Dashboard
            </Link>
            {" · "}
            <Link className="underline underline-offset-4" href={`/pipeline/${record.id}`}>
              Open brief
            </Link>
          </p>
          <BriefEditor key={`${record.id}:${record.updatedAt}`} record={record} onChange={setRecord} />
        </div>
      ) : null}
    </div>
  )
}
