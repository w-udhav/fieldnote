import { IntakeError } from "@/lib/errors"
import { requireAuth } from "@/lib/guard"
import { intakeLinkedInUrl } from "@/lib/intake"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  let url = ""
  try {
    const body = (await request.json()) as { url?: string }
    url = body.url?.trim() ?? ""
  } catch {
    return Response.json({ error: "Send a JSON body with a url." }, { status: 400 })
  }
  if (!url) return Response.json({ error: "Paste a LinkedIn URL." }, { status: 400 })

  try {
    const filed = await intakeLinkedInUrl(url)
    return Response.json(filed)
  } catch (error) {
    if (error instanceof IntakeError) {
      return Response.json({ error: error.message, code: error.code }, { status: 422 })
    }
    console.error("intake failed", error instanceof Error ? error.message : error)
    return Response.json({ error: "Could not file this link." }, { status: 500 })
  }
}
