"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon } from "lucide-react"
import Link from "next/link"
import { ApiError, api } from "@/lib/client"
import type { BriefRecord, NotionBrief } from "@/lib/types"
import { BriefEditor } from "@/components/brief-editor"
import { PageHeader } from "@/components/page-header"
import { RefreshMark } from "@/components/refresh-mark"
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
  const queryClient = useQueryClient()
  const briefQuery = useQuery({
    queryKey: ["record", id],
    queryFn: () => api<{ record: BriefRecord; notion: NotionBrief | null }>(`/api/records/${id}`),
    retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status === 404),
  })
  const record = briefQuery.data?.record ?? null
  const notion = briefQuery.data?.notion ?? null
  const missing = briefQuery.error instanceof ApiError && briefQuery.error.status === 404
  const error =
    briefQuery.error && !missing
      ? briefQuery.error instanceof Error
        ? briefQuery.error.message
        : "Could not open this brief."
      : ""

  function onChange(next: BriefRecord) {
    queryClient.setQueryData(["record", id], (current: { record: BriefRecord; notion: NotionBrief | null } | undefined) => ({
      record: next,
      notion: current?.notion ?? notion,
    }))
    void queryClient.invalidateQueries({ queryKey: ["notion-briefs"] })
  }

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
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" />
          Loading brief
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <BriefCrumb current={record.title || "Brief"} />
      <PageHeader
        title={record.title || "Brief"}
        description={[
          `Job ID: ${record.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
          record.company,
          notion?.workflow ? `Workflow: ${notion.workflow}` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex items-center gap-3">
            <RefreshMark updatedAt={briefQuery.dataUpdatedAt} fetching={briefQuery.isFetching} />
            <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/pipeline" />}>
              Dashboard
            </Button>
          </div>
        }
      />
      <BriefEditor
        key={`${record.id}:${record.updatedAt}:${notion?.updatedAt ?? ""}`}
        record={record}
        notion={notion}
        onChange={onChange}
      />
    </div>
  )
}
