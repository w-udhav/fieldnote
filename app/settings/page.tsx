"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/pipeline?settings=open")
  }, [router])
  return (
    <p className="py-8 text-sm text-muted-foreground">Opening settings…</p>
  )
}
