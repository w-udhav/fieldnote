"use client"

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createPortal } from "react-dom"
import Link from "next/link"
import { ChevronDownIcon, Loader2Icon, MailIcon, SparklesIcon, TimerIcon, CheckCircle2Icon } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/client"
import type { NotionBrief } from "@/lib/types"
import { CompanyDetailsDialog } from "@/components/company-research-details"
import { PageHeader } from "@/components/page-header"
import { RefreshMark } from "@/components/refresh-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const FILTERS = ["All", "Queued", "Ready", "Sent"] as const
const SORTS = [
  { value: "filed-desc", label: "Newest filed" },
  { value: "filed-asc", label: "Oldest filed" },
  { value: "posted-desc", label: "Newest posted" },
  { value: "role-asc", label: "Role A–Z" },
  { value: "company-asc", label: "Company A–Z" },
] as const

type SortValue = (typeof SORTS)[number]["value"]

function timestamp(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function jobId(brief: NotionBrief) {
  return brief.recordId || brief.pageId
}

function shortJobId(brief: NotionBrief) {
  return jobId(brief).replace(/-/g, "").slice(0, 8).toUpperCase()
}

function formatWhen(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date)
}

function workflowClass(workflow: string | null) {
  const value = workflow?.toLowerCase() ?? ""
  if (value === "ready") return "border-transparent bg-emerald-500/15 text-emerald-300"
  if (value === "sent") return "border-transparent bg-sky-500/15 text-sky-300"
  if (value === "queued") return "border-transparent bg-amber-500/15 text-amber-200"
  if (value === "ai pending") return "border-transparent bg-violet-500/15 text-violet-200"
  if (value === "ai failed") return "border-transparent bg-red-500/15 text-red-300"
  return ""
}

function RowActions({ brief, onDone }: { brief: NotionBrief; onDone: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState<"send" | "rewrite" | null>(null)
  const sent = brief.workflow?.toLowerCase() === "sent"
  const ready = brief.workflow?.toLowerCase() === "ready"

  async function send() {
    setBusy("send")
    try {
      await api(`/api/records/${brief.recordId}/send`, {
        method: "POST",
        body: JSON.stringify({
          draft: {
            to: brief.draftTo ?? "",
            subject: brief.aiSubject ?? "",
            body: brief.aiBody ?? "",
          },
        }),
      })
      toast.success("Sent.")
      onDone()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Mail was not sent.")
    } finally {
      setBusy(null)
    }
  }

  async function rewrite() {
    setOpen(false)
    setBusy("rewrite")
    try {
      await api(`/api/records/${brief.recordId}/rewrite`, { method: "POST", body: "{}" })
      toast.success("Draft rewritten.")
      onDone()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not rewrite the draft.")
    } finally {
      setBusy(null)
    }
  }

  const menuButton = useRef<HTMLButtonElement>(null)
  const [menuBox, setMenuBox] = useState<{ top: number; right: number } | null>(null)

  function placeMenu() {
    const rect = menuButton.current?.getBoundingClientRect()
    if (!rect) return
    setMenuBox({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }

  React.useEffect(() => {
    if (!open) return
    function close() {
      setOpen(false)
    }
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [open])

  if (!brief.recordId || sent) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="flex w-fit justify-end">
      <Button
        type="button"
        size="sm"
        className="rounded-r-none bg-blue-600 text-white hover:bg-blue-500"
        disabled={!ready || busy !== null}
        onClick={() => void send()}
      >
        {busy === "send" ? <Loader2Icon className="animate-spin" /> : null}
        Send
      </Button>
      <Button
        ref={menuButton}
        type="button"
        size="sm"
        variant="outline"
        className="rounded-l-none border-blue-600 bg-blue-600 px-2 text-white hover:bg-blue-500 hover:text-white"
        aria-label="More actions"
        aria-expanded={open}
        disabled={busy !== null}
        onClick={() => {
          if (open) {
            setOpen(false)
            return
          }
          placeMenu()
          setOpen(true)
        }}
      >
        <ChevronDownIcon />
      </Button>
      {open && menuBox
        ? createPortal(
            <div
              className="fixed z-50 min-w-36 rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10"
              style={{ top: menuBox.top, right: menuBox.right }}
            >
              <button
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => void rewrite()}
              >
                {busy === "rewrite" ? "Rewriting…" : "Rewrite"}
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  )
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
    <Card className="bg-card/40 shadow-none">
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
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All")
  const [sort, setSort] = useState<SortValue>("filed-desc")
  const [syncing, setSyncing] = useState(false)
  const briefsQuery = useQuery({
    queryKey: ["notion-briefs"],
    queryFn: async () => {
      const data = await api<{ briefs: NotionBrief[] }>("/api/notion/briefs")
      return data.briefs
    },
  })
  const briefs = briefsQuery.data ?? null
  const error = briefsQuery.error instanceof Error ? briefsQuery.error.message : ""

  function reload() {
    return queryClient.invalidateQueries({ queryKey: ["notion-briefs"] })
  }

  useEffect(() => {
    const onFiled = () => void reload()
    window.addEventListener("fieldnote-filed", onFiled)
    return () => window.removeEventListener("fieldnote-filed", onFiled)
  }, [queryClient])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void api<{ updated: number }>("/api/replies/sync", { method: "POST", body: "{}" })
        .then((data) => {
          if (!cancelled && data.updated > 0) void reload()
        })
        .catch(() => undefined)
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [queryClient])

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
    const rows =
      filter === "All"
        ? [...briefs]
        : briefs.filter((brief) => brief.workflow?.toLowerCase() === filter.toLowerCase())
    rows.sort((a, b) => {
      if (sort === "filed-asc") return timestamp(a.createdAt) - timestamp(b.createdAt)
      if (sort === "posted-desc") return timestamp(b.publishedAt) - timestamp(a.publishedAt)
      if (sort === "role-asc") return a.title.localeCompare(b.title)
      if (sort === "company-asc") return a.company.localeCompare(b.company)
      return timestamp(b.createdAt) - timestamp(a.createdAt)
    })
    return rows
  }, [briefs, filter, sort])

  async function refreshReplies() {
    setSyncing(true)
    try {
      const data = await api<{ updated: number }>("/api/replies/sync", {
        method: "POST",
        body: JSON.stringify({}),
      })
      await reload()
      toast.success(data.updated ? `Updated ${data.updated} repl${data.updated === 1 ? "y" : "ies"}.` : "No new replies.")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Reply sync failed.")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/pipeline" className="hover:text-foreground">
          Fieldnote
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Dashboard</span>
      </nav>
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

      <Card className="bg-card/40 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Applications</CardTitle>
            <CardDescription>Filter by workflow. Ready means the mail draft is written.</CardDescription>
          </div>
          <RefreshMark updatedAt={briefsQuery.dataUpdatedAt} fetching={briefsQuery.isFetching} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={filter}
              onValueChange={(value) => {
                if (value === "All" || value === "Queued" || value === "Ready" || value === "Sent") setFilter(value)
              }}
            >
              <TabsList>
                {FILTERS.map((item) => (
                  <TabsTrigger key={item} value={item}>
                    {item}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Select value={sort} onValueChange={(value) => setSort(value as SortValue)}>
              <SelectTrigger size="sm" aria-label="Sort applications">
                <span>{SORTS.find((item) => item.value === sort)?.label}</span>
              </SelectTrigger>
              <SelectContent align="end">
                {SORTS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {briefs === null && briefsQuery.isFetching ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2Icon className="size-3 animate-spin" />
              Loading from Notion
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {briefs && briefs.length === 0 && !error ? (
            <div className="rounded-lg bg-muted/40 py-12 text-center">
              <p className="font-medium">No rows yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Connect Notion in Settings, then paste a link under Quick create.</p>
              <Button nativeButton={false} size="sm" className="mt-4" render={<Link href="/pipeline?paste=open" />}>
                Paste link
              </Button>
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Job ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Poster</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reply</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((brief) => (
                    <TableRow key={brief.pageId}>
                      <TableCell className="font-mono text-xs text-muted-foreground" title={jobId(brief)}>
                        {shortJobId(brief)}
                      </TableCell>
                      <TableCell className="max-w-[280px] font-medium">
                        <Link
                          className="hover:underline underline-offset-4"
                          href={`/pipeline/${brief.recordId || brief.pageId}`}
                        >
                          {brief.title || "Untitled"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <CompanyDetailsDialog company={brief.company} />
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {brief.categories?.length ? (
                            brief.categories.map((category) => (
                              <Badge key={category} variant="outline" className="text-[10px]">
                                {category}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{brief.authorName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatWhen(brief.publishedAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={workflowClass(brief.workflow)}>
                          {brief.workflow || "—"}
                        </Badge>
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
                      <TableCell className="text-right">
                        <RowActions brief={brief} onDone={() => void reload()} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
