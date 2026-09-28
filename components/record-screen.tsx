"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "@/lib/client"
import type { BriefRecord } from "@/lib/types"
import { BriefEditor } from "@/components/brief-editor"
import { Button } from "@/components/ui/button"

export function RecordScreen({ id }: { id: string }) {
  const router = useRouter()
  const [record, setRecord] = useState<BriefRecord | null>(null)
  const [error, setError] = useState("")
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    void api<{ record: BriefRecord }>(`/api/records/${id}`)
      .then((data) => setRecord(data.record))
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
      <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
        <h1 className="font-heading text-3xl">This brief is gone</h1>
        <p className="mt-2 text-sm text-muted-foreground">It is not in the local pipeline.</p>
        <Link className="mt-4 inline-block text-sm underline decoration-border underline-offset-4" href="/pipeline">
          Back to the pipeline
        </Link>
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!record) return <p className="text-sm text-muted-foreground">Loading brief…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm underline decoration-border underline-offset-4" href="/pipeline">
          Back to pipeline
        </Link>
        <Button type="button" variant="ghost" onClick={() => void remove()}>
          Remove
        </Button>
      </div>
      <BriefEditor key={`${record.id}:${record.updatedAt}`} record={record} onChange={setRecord} />
    </div>
  )
}
