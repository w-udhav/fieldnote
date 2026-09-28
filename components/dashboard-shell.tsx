"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SettingsIcon } from "lucide-react"
import { IntakeDesk } from "@/components/intake-desk"
import { SettingsDialog } from "@/components/settings-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [settings, setSettings] = React.useState(false)
  const [paste, setPaste] = React.useState(false)
  const querySettings = searchParams.get("settings") === "open"
  const queryPaste = searchParams.get("paste") === "open"

  if (querySettings && !settings) setSettings(true)
  if (queryPaste && !paste) setPaste(true)

  React.useEffect(() => {
    if (!querySettings && !queryPaste) return
    router.replace(pathname)
  }, [pathname, queryPaste, querySettings, router])

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:px-6">
        <Link href="/pipeline" className="text-sm font-semibold tracking-tight">
          Fieldnote
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPaste(true)}>
            Paste link
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setSettings(true)}>
            <SettingsIcon />
            Settings
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void fetch("/api/logout", { method: "POST" }).finally(() => {
                router.push("/login")
                router.refresh()
              })
            }}
          >
            Sign out
          </Button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      <SettingsDialog open={settings} onOpenChange={setSettings} />
      <Dialog open={paste} onOpenChange={setPaste}>
        <DialogContent className="flex max-h-[min(90dvh,40rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
            <DialogTitle>Paste a LinkedIn link</DialogTitle>
            <DialogDescription>Public job or post URLs. Filed to Notion from this dashboard.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <IntakeDesk
              embedded
              onFiled={() => {
                window.dispatchEvent(new Event("fieldnote-filed"))
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
