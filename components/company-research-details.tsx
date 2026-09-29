"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon, Loader2Icon } from "lucide-react"
import { api } from "@/lib/client"
import type { CompanyProfile } from "@/lib/notion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function useCompanyResearch(company: string, enabled: boolean) {
  return useQuery({
    queryKey: ["company-research", company.toLowerCase()],
    queryFn: async () => {
      const data = await api<{ company: CompanyProfile | null }>(
        `/api/companies/${encodeURIComponent(company)}`
      )
      return data.company
    },
    enabled: enabled && Boolean(company.trim()),
  })
}

function Details({ profile }: { profile: CompanyProfile }) {
  const rows = [
    ["What they do", profile.whatTheyDo],
    ["Product", profile.product],
    ["Research hook", profile.hook],
    ["Domain", profile.domain],
    ["Fetched", profile.fetchedAt],
  ].filter((row) => row[1])
  return (
    <div className="flex flex-col gap-4">
      {rows.length ? (
        <dl className="grid gap-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 leading-6">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">No sourced facts were extracted.</p>
      )}
      {profile.sourceUrl ? (
        <div className="text-sm">
          <p className="text-muted-foreground">Source</p>
          <a
            href={profile.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 break-all underline decoration-border underline-offset-4"
          >
            {profile.sourceUrl}
            <ExternalLinkIcon className="size-3 shrink-0" />
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No source page was fetched.</p>
      )}
    </div>
  )
}

export function CompanyResearchDetails({ company }: { company: string }) {
  const query = useCompanyResearch(company, true)
  if (!company) return null
  return (
    <section className="rounded-lg bg-muted/45 p-3">
      <h3 className="text-sm font-medium">Company research</h3>
      {query.isLoading ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" />
          Loading company details
        </p>
      ) : query.error ? (
        <p className="mt-2 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Could not load company details."}
        </p>
      ) : query.data ? (
        <div className="mt-3">
          <Details profile={query.data} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No company research has been saved for {company}.
        </p>
      )}
    </section>
  )
}

export function CompanyDetailsDialog({ company }: { company: string }) {
  const [open, setOpen] = useState(false)
  const query = useCompanyResearch(company, open)
  if (!company) return <span className="text-muted-foreground">—</span>
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {company}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{company}</DialogTitle>
            <DialogDescription>Sourced company research used by the cover template.</DialogDescription>
          </DialogHeader>
          {query.isLoading ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2Icon className="size-3 animate-spin" />
              Loading company details
            </p>
          ) : query.error ? (
            <p className="text-sm text-destructive">
              {query.error instanceof Error ? query.error.message : "Could not load company details."}
            </p>
          ) : query.data ? (
            <Details profile={query.data} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No company research has been saved for {company}.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
