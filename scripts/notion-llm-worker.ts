import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  ensureNotionTags,
  pagePlainText,
  queryBriefs,
  updateNotionWriter,
} from "../lib/notion"
import { draftOutreach } from "../lib/outreach"
import { loadSettings } from "../lib/settings"
import type { NotionBrief } from "../lib/types"

async function loadEnvFile() {
  try {
    const raw = await readFile(path.join(process.cwd(), ".env"), "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // The process environment is already set.
  }
}

const sleepMs = Number(process.env.WORKER_INTERVAL_MS || 120000)

async function writeDraft(
  settings: Awaited<ReturnType<typeof loadSettings>>,
  brief: NotionBrief,
  description: string
) {
  return draftOutreach({
    settings,
    title: brief.title,
    company: brief.company,
    authorName: brief.authorName,
    description,
    kind: brief.kind === "job" || brief.kind === "post" || brief.kind === "page" ? brief.kind : undefined,
  })
}

async function tick() {
  const settings = await loadSettings()
  const token = settings.notionToken.trim()
  const databaseId = settings.notionDatabaseId.trim()
  if (!token || !databaseId) {
    throw new Error("Set NOTION_TOKEN and NOTION_DATABASE_ID in .env, or save them in Settings.")
  }
  const { briefs } = await queryBriefs(token, databaseId)
  const queued = briefs
    .filter((brief) => brief.workflow?.toLowerCase() === "queued" && !brief.aiBody?.trim())
    .slice(0, 3)
  if (!queued.length) {
    console.log("No queued briefs.")
    return
  }

  const schema = await ensureNotionTags(token, databaseId)
  for (const brief of queued) {
    console.log(`Writing ${brief.title || brief.pageId}`)
    try {
      await updateNotionWriter(token, brief.pageId, schema, { workflow: "AI pending" })
      const description = await pagePlainText(token, brief.pageId)
      const draft = await writeDraft(settings, brief, description)
      await updateNotionWriter(token, brief.pageId, schema, {
        workflow: "Ready",
        subject: draft.subject,
        body: draft.body,
        company: draft.company,
        role: draft.role,
        categories: draft.categories,
      })
      console.log(`Ready: ${draft.subject}${draft.company ? ` (${draft.company})` : ""}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Writer failed."
      console.error(message)
      try {
        await updateNotionWriter(token, brief.pageId, schema, { workflow: "AI failed" })
      } catch (updateError) {
        console.error(updateError instanceof Error ? updateError.message : updateError)
      }
    }
  }
}

async function main() {
  await loadEnvFile()
  console.log("Fieldnote writer started.")
  for (;;) {
    try {
      await tick()
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
    }
    await new Promise((resolve) => setTimeout(resolve, sleepMs))
  }
}

void main()
