import { Loader2Icon } from "lucide-react"

export function RefreshMark({ updatedAt, fetching }: { updatedAt: number; fetching: boolean }) {
  const label =
    updatedAt > 0
      ? `Last refreshed at ${new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(updatedAt)}`
      : ""
  if (!label && !fetching) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {fetching ? <Loader2Icon className="size-3 animate-spin" /> : null}
      {label}
    </span>
  )
}
