"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { SettingsForm } from "@/components/settings-form"

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92dvh,44rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <SettingsForm />
      </DialogContent>
    </Dialog>
  )
}
