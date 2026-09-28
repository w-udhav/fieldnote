"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2Icon, MailIcon, SparklesIcon, TimerIcon, CheckCircle2Icon } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/client"
import type { NotionBrief } from "@/lib/types"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "cn"

const FILTERS = ["All", "Queued", "Ready", "Sent"] as const

function formatWhen(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date)
}

function workflowVariant(workflow: string | null) {
  const value = workflow?.toLowerCase() ?? ""
  if (value === "ready") return "default" as const
  if (value === "sent") return "secondary" as const
  if (value === "ai failed" || value === "ai pending") return "destructive" as const
  return "outline" as const
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  hint: string
}) {
  return (
    <Card className="border-border/60 bg-card/40 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

export function PipelineList() {
  const [briefs, setBriefs] = useState<NotionBrief[] | null>(null)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All")
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(() => {
    return api<{ briefs: NotionBrief[] }>("/api/notion/briefs")
      .then((data) => {
        setBriefs(data.briefs)
        setError("")
      })
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : "Could not load the dashboard."
        setError(message)
        setBriefs([])
      })
  }, [])

  useEffect(() => {
    void load()
    const onFiled = () => void load()
    window.addEventListener("fieldnote-filed", onFiled)
    return () => window.removeEventListener("fieldnote-filed", onFiled)
  }, [load])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void api<{ updated: number }>("/api/replies/sync", { method: "POST", body: "{}" })
        .then((data) => {
          if (!cancelled && data.updated > 0) void load()
        })
        .catch(() => undefined)
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [load])

  const stats = useMemo(() => {
    const list = briefs ?? []
    return {
      total: list.length,
      queued: list.filter((b) => b.workflow?.toLowerCase() === "queued").length,
      ready: list.filter((b) => b.workflow?.toLowerCase() === "ready").length,
      sent: list.filter((b) => b.workflow?.toLowerCase() === "sent").length,
      unread: list.filter((b) => b.hasUnreadReply).length,
    }
  }, [briefs])

  const filtered = useMemo(() => {
    if (!briefs) return []
    if (filter === "All") return briefs
    return briefs.filter((brief) => brief.workflow?.toLowerCase() === filter.toLowerCase())
  }, [briefs, filter])

  async function refreshReplies() {
    setSyncing(true)
    try {
      const data = await api<{ updated: number }>("/api/replies/sync", {
        method: "POST",
        body: JSON.stringify({}),
      })
      await load()
      toast.success(data.updated ? `Updated ${data.updated} repl${data.updated === 1 ? "y" : "ies"}.` : "No new replies.")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Reply sync failed.")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Jobs filed to Notion. Open a row when the AI draft is ready, then send."
        actions={
          <Button type="button" variant="outline" size="sm" disabled={syncing} onClick={() => void refreshReplies()}>
            {syncing ? <Loader2Icon className="animate-spin" /> : null}
            Refresh replies
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total briefs" value={stats.total} icon={SparklesIcon} hint="Rows in Notion" />
        <StatCard label="Queued" value={stats.queued} icon={TimerIcon} hint="Waiting on AI writer" />
        <StatCard label="Ready to send" value={stats.ready} icon={MailIcon} hint="Draft in Notion" />
        <StatCard label="Sent" value={stats.sent} icon={CheckCircle2Icon} hint={`${stats.unread} unread repl${stats.unread === 1 ? "y" : "ies"}`} />
      </div>

      <Card className="border-border/60 bg-card/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Applications</CardTitle>
          <CardDescription>Filter by workflow. Ready means the mail draft is written.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === item
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item}
              </button>
            ))}
          </div>

          {briefs === null ? (
            <p className="text-sm text-muted-foreground">Loading from Notion…</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {briefs && briefs.length === 0 && !error ? (
            <div className="rounded-lg border border-dashed border-border/80 py-12 text-center">
              <p className="font-medium">No rows yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Connect Notion in Settings, then paste a link under Quick create.</p>
              <Button nativeButton={false} size="sm" className="mt-4" render={<Link href="/pipeline?paste=open" />}>
                Paste link
              </Button>
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <div className="rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Role</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Poster</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reply</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((brief) => (
                    <TableRow key={brief.pageId}>
                      <TableCell className="max-w-[200px] font-medium">
                        {brief.recordId ? (
                          <Link
                            className="hover:underline underline-offset-4"
                            href={`/pipeline/${brief.recordId}`}
                          >
                            {brief.title || "Untitled"}
                          </Link>
                        ) : (
                          brief.title || "Untitled"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{brief.company || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{brief.authorName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatWhen(brief.publishedAt)}</TableCell>
                      <TableCell>
                        <Badge variant={workflowVariant(brief.workflow)}>{brief.workflow || "—"}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        {brief.lastReplySnippet ? (
                          <span className="flex flex-col gap-1 text-xs">
                            {brief.hasUnreadReply ? (
                              <Badge variant="default" className="w-fit text-[10px]">
                                Unread
                              </Badge>
                            ) : null}
                            <span className="line-clamp-2 text-muted-foreground">{brief.lastReplySnippet}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
