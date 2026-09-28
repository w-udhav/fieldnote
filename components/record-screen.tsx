"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "@/lib/client"
import type { BriefRecord, NotionBrief } from "@/lib/types"
import { BriefEditor } from "@/components/brief-editor"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export function RecordScreen({ id }: { id: string }) {
  const router = useRouter()
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

  async function remove() {
    if (!window.confirm("Remove this brief from the local pipeline?")) return
    try {
      await api(`/api/records/${id}`, { method: "DELETE" })
      toast.success("Brief removed.")
      router.push("/pipeline")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not remove the brief.")
    }
  }

  if (missing) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Brief missing" description="This record is not in the local pipeline." />
        <Button nativeButton={false} variant="outline" className="w-fit" render={<Link href="/pipeline" />}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!record) return <p className="text-sm text-muted-foreground">Loading brief…</p>

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={record.title || "Brief"}
        description={[record.company, notion?.workflow ? `Workflow: ${notion.workflow}` : ""]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/pipeline" />}>
              Dashboard
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
              Remove
            </Button>
          </>
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
