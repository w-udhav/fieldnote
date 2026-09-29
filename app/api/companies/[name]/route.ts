import { requireAuth } from "@/lib/guard"
import { findCompany } from "@/lib/notion"
import { loadSettings } from "@/lib/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> }
) {
  const denied = await requireAuth(request)
  if (denied) return denied
  const { name } = await context.params
  const settings = await loadSettings()
  if (!settings.notionToken || !settings.notionCompaniesDatabaseId) {
    return Response.json({ company: null })
  }
  try {
    const company = await findCompany(
      settings.notionToken,
      settings.notionCompaniesDatabaseId,
      name
    )
    return Response.json({ company })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load company research." },
      { status: 422 }
    )
  }
}
