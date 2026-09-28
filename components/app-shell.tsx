"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SiteHeader } from "@/components/site-header"

type Gate = "loading" | "ready" | "key" | "blocked"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [gate, setGate] = useState<Gate>("loading")
  const [deskKey, setDeskKey] = useState("")
  const [error, setError] = useState("")

  async function check(candidate?: string) {
    const stored = candidate ?? window.sessionStorage.getItem("fieldnote-key") ?? ""
    const response = await fetch("/api/health", {
      headers: stored ? { "x-fieldnote-key": stored } : {},
    })
    const data = (await response.json()) as { mode: string; authorized: boolean }
    if (data.mode === "blocked") {
      setGate("blocked")
      return
    }
    if (data.mode === "key" && !data.authorized) {
      setGate("key")
      return
    }
    if (candidate) window.sessionStorage.setItem("fieldnote-key", candidate)
    setGate("ready")
  }

  useEffect(() => {
    const stored = window.sessionStorage.getItem("fieldnote-key") ?? ""
    void fetch("/api/health", {
      headers: stored ? { "x-fieldnote-key": stored } : {},
    })
      .then((response) => response.json() as Promise<{ mode: string; authorized: boolean }>)
      .then((data) => {
        if (data.mode === "blocked") setGate("blocked")
        else if (data.mode === "key" && !data.authorized) setGate("key")
        else setGate("ready")
      })
      .catch(() => setGate("blocked"))
  }, [])

  if (gate === "loading") {
    return <p className="px-6 py-16 text-sm text-muted-foreground">Opening the desk…</p>
  }

  if (gate === "blocked") {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-heading text-3xl">This desk is locked</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Set <span className="font-medium text-foreground">FIELDNOTE_KEY</span> on the server,
          then enter it here. A public deploy without that key is refused so saved mail logins
          cannot be used by anyone who finds the site.
        </p>
      </main>
    )
  }

  if (gate === "key") {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-heading text-3xl">Unlock Fieldnote</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This desk can send mail and holds your Notion and sheet credentials. Enter the key from
          FIELDNOTE_KEY. It stays in this browser tab.
        </p>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            setError("")
            void check(deskKey).then(() => {
              if (!window.sessionStorage.getItem("fieldnote-key")) {
                setError("That key did not match.")
              }
            })
          }}
        >
          <Input
            type="password"
            value={deskKey}
            onChange={(event) => setDeskKey(event.target.value)}
            placeholder="Desk key"
            className="h-10"
            autoFocus
          />
          <Button type="submit" className="h-10">
            Unlock
          </Button>
        </form>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </main>
    )
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </>
  )
}
