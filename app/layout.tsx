import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const inter = Inter({
  variable: "--font-source",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Fieldnote",
  description: "File public LinkedIn jobs and posts, then send the mail when you are ready.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-svh bg-background text-foreground">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  )
}
