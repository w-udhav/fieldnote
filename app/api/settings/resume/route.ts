import { access, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { requireAuth } from "@/lib/guard"
import { loadSettings, resolveResumePath, saveSettings, toPublic } from "@/lib/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 5 * 1024 * 1024

export async function POST(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const form = await request.formData()
  const file = form.get("resume")
  if (!(file instanceof File)) {
    return Response.json({ error: "Upload a PDF file named resume." }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return Response.json({ error: "The resume must be a PDF." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "The resume must be 5 MB or smaller." }, { status: 400 })
  }

  const settings = await loadSettings()
  const target = resolveResumePath(settings)
  await mkdir(path.dirname(target), { recursive: true })
  const bytes = Buffer.from(await file.arrayBuffer())
  await writeFile(target, bytes)

  const relative = path.join("data", "resume.pdf")
  const saved = await saveSettings({ resumePath: relative })
  return Response.json({ settings: await toPublic(saved) })
}

export async function GET(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const settings = await loadSettings()
  const target = resolveResumePath(settings)
  try {
    await access(target)
  } catch {
    return Response.json({ error: "No resume uploaded yet." }, { status: 404 })
  }

  const file = await import("node:fs/promises").then((fs) => fs.readFile(target))
  return new Response(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="resume.pdf"',
    },
  })
}
