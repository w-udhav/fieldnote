"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(data.error || "Could not sign in.")
        return
      }
      router.push("/pipeline")
      router.refresh()
    } catch {
      setError("Could not sign in.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border/60 bg-card/40 shadow-none">
        <CardHeader>
          <CardTitle>Fieldnote</CardTitle>
          <CardDescription>Enter the desk password to open the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="desk-password">Password</Label>
              <Input
                id="desk-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
                className="h-10"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="h-10" disabled={pending || !password}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
