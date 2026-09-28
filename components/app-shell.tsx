"use client"

import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/login") return children

  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  )
}
