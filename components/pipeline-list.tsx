"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/client"
import type { BriefRecord } from "@/lib/types"
import { Badge } from "@/components/ui/badge"

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function PipelineList() {
  const [records, setRecords] = useState<BriefRecord[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    void api<{ records: BriefRecord[] }>("/api/records")
      .then((data) => setRecords(data.records))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Could not load the pipeline.")
        setRecords([])
      })
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-4xl tracking-tight">Pipeline</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Briefs filed from public LinkedIn links. Open one to edit the draft or send it.
        </p>
      </div>

      {records === null ? <p className="text-sm text-muted-foreground">Loading briefs…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {records && records.length === 0 && !error ? (
        <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
          <p className="font-heading text-2xl">Nothing filed yet</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Paste a LinkedIn job or post link on Intake. It will show up here with the draft attached.
          </p>
          <Link className="mt-4 inline-block text-sm underline decoration-border underline-offset-4" href="/">
            Go to Intake
          </Link>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {records?.map((record) => (
          <li key={record.id}>
            <Link
              href={`/pipeline/${record.id}`}
              className="block rounded-2xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-foreground/20"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{record.kind}</Badge>
                <Badge variant={record.status === "sent" ? "default" : record.status === "send_failed" ? "destructive" : "outline"}>
                  {record.status === "send_failed" ? "Send failed" : record.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatWhen(record.createdAt)}</span>
              </div>
              <p className="mt-2 font-heading text-xl">{record.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[record.company, record.authorName, record.emails[0], record.phones[0]]
                  .filter(Boolean)
                  .join(" · ") || "No contact on the public page"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
