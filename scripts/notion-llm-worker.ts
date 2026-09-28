import {
  getDatabaseSchema,
  pagePlainText,
  queryBriefs,
  updateNotionWriter,
} from "../lib/notion"
import { parseModelJson, WRITER_SYSTEM, writerPrompt } from "../lib/writer"
import type { NotionBrief } from "../lib/types"

const sleepMs = Number(process.env.WORKER_INTERVAL_MS || 120000)

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Set ${name} before starting the worker.`)
  return value
}

async function writeDraft(brief: NotionBrief, description: string) {
  const host = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "")
  const model = required("OLLAMA_MODEL")
  const response = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: WRITER_SYSTEM },
        {
          role: "user",
          content: writerPrompt({
            title: brief.title,
            company: brief.company,
            authorName: brief.authorName,
            url: brief.finalUrl ?? "",
            description,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text.slice(0, 280) || `Ollama returned ${response.status}.`)
  }
  const json = (await response.json()) as { message?: { content?: string } }
  return parseModelJson(json.message?.content ?? "")
}

async function tick() {
  const token = required("NOTION_TOKEN")
  const databaseId = required("NOTION_DATABASE_ID")
  const { briefs } = await queryBriefs(token, databaseId)
  const queued = briefs
    .filter((brief) => brief.workflow?.toLowerCase() === "queued" && !brief.aiBody?.trim())
    .slice(0, 3)
  if (!queued.length) {
    console.log("No queued briefs.")
    return
  }

  const schema = await getDatabaseSchema(token, databaseId)
  for (const brief of queued) {
    console.log(`Writing ${brief.title || brief.pageId}`)
    try {
      await updateNotionWriter(token, brief.pageId, schema, { workflow: "AI pending" })
      const description = await pagePlainText(token, brief.pageId)
      const draft = await writeDraft(brief, description)
      await updateNotionWriter(token, brief.pageId, schema, {
        workflow: "Ready",
        subject: draft.subject,
        body: draft.body,
      })
      console.log(`Ready: ${draft.subject}`)
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
