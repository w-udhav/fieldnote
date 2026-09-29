"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/client"
import type { BriefRecord, NotionBrief } from "@/lib/types"
import { BriefEditor } from "@/components/brief-editor"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

function BriefCrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <Link href="/pipeline" className="hover:text-foreground">
        Fieldnote
      </Link>
      <span className="px-1.5">/</span>
      <Link href="/pipeline" className="hover:text-foreground">
        Dashboard
      </Link>
      <span className="px-1.5">/</span>
      <span className="text-foreground">{current}</span>
    </nav>
  )
}

export function RecordScreen({ id }: { id: string }) {
  const [record, setRecord] = useState<BriefRecord | null>(null)
  const [notion, setNotion] = useState<NotionBrief | null>(null)
  const [error, setError] = useState("")
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    void api<{ record: BriefRecord; notion: NotionBrief | null }>(`/api/records/${id}`)
      .then((data) => {
        setRecord(data.record)
        setNotion(data.notion)
      })
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : "Could not open this brief."
        if (message.includes("not in the pipeline")) setMissing(true)
        else setError(message)
      })
  }, [id])

  if (missing) {
    return (
      <div className="flex flex-col gap-6">
        <BriefCrumb current="Brief missing" />
        <PageHeader title="Brief missing" description="This record is not in the local pipeline." />
        <Button nativeButton={false} variant="outline" className="w-fit" render={<Link href="/pipeline" />}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <BriefCrumb current="Brief" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }
  if (!record) {
    return (
      <div className="flex flex-col gap-6">
        <BriefCrumb current="Brief" />
        <p className="text-sm text-muted-foreground">Loading brief…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <BriefCrumb current={record.title || "Brief"} />
      <PageHeader
        title={record.title || "Brief"}
        description={[record.company, notion?.workflow ? `Workflow: ${notion.workflow}` : ""]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/pipeline" />}>
            Dashboard
          </Button>
        }
      />
      <BriefEditor
        key={`${record.id}:${record.updatedAt}:${notion?.updatedAt ?? ""}`}
        record={record}
        notion={notion}
        onChange={setRecord}
      />
    </div>
  )
}
