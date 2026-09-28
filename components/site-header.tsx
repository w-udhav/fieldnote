"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

const links = [
  { href: "/", label: "Intake" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/settings", label: "Settings" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="border-b border-border bg-card/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <Link href="/" className="group">
          <span className="font-heading text-2xl tracking-tight text-foreground">Fieldnote</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            File a LinkedIn brief. Send the mail when you mean to.
          </span>
        </Link>
        <nav className="flex gap-1">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
