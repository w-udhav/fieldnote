"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDownIcon, SettingsIcon } from "lucide-react"
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
  const [accountOpen, setAccountOpen] = React.useState(false)
  const accountButton = React.useRef<HTMLButtonElement>(null)
  const [accountBox, setAccountBox] = React.useState<{ top: number; right: number } | null>(null)
  const querySettings = searchParams.get("settings") === "open"
  const queryPaste = searchParams.get("paste") === "open"

  if (querySettings && !settings) setSettings(true)
  if (queryPaste && !paste) setPaste(true)

  React.useEffect(() => {
    if (!querySettings && !queryPaste) return
    router.replace(pathname)
  }, [pathname, queryPaste, querySettings, router])

  React.useEffect(() => {
    if (!accountOpen) return
    function close() {
      setAccountOpen(false)
    }
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [accountOpen])

  function placeAccountMenu() {
    const rect = accountButton.current?.getBoundingClientRect()
    if (!rect) return
    setAccountBox({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }

  function signOut() {
    setAccountOpen(false)
    void fetch("/api/logout", { method: "POST" }).finally(() => {
      router.push("/login")
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
        <Link href="/pipeline" className="text-sm font-semibold tracking-tight">
          Fieldnote
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPaste(true)}>
            Paste link
          </Button>
          <div className="flex">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-r-none"
              onClick={() => setSettings(true)}
            >
              <SettingsIcon />
              Settings
            </Button>
            <Button
              ref={accountButton}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-l-none border-l-0 px-2"
              aria-label="Account menu"
              aria-expanded={accountOpen}
              onClick={() => {
                if (accountOpen) {
                  setAccountOpen(false)
                  return
                }
                placeAccountMenu()
                setAccountOpen(true)
              }}
            >
              <ChevronDownIcon />
            </Button>
          </div>
          {accountOpen && accountBox
            ? createPortal(
                <div
                  className="fixed z-50 min-w-36 rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10"
                  style={{ top: accountBox.top, right: accountBox.right }}
                >
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={signOut}
                  >
                    Sign out
                  </button>
                </div>,
                document.body
              )
            : null}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      <SettingsDialog open={settings} onOpenChange={setSettings} />
      <Dialog open={paste} onOpenChange={setPaste}>
        <DialogContent className="flex max-h-[min(90dvh,40rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
            <DialogTitle>Paste LinkedIn links</DialogTitle>
            <DialogDescription>One URL per line. Each is filed to Notion and queued for the writer.</DialogDescription>
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
