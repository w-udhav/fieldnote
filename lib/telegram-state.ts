import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

export const TELEGRAM_STATE_FILE = path.join(process.cwd(), "data", "telegram-state.json")

export async function readTelegramOffset(file = TELEGRAM_STATE_FILE) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as { offset?: unknown }
    return typeof parsed.offset === "number" && Number.isInteger(parsed.offset) && parsed.offset >= 0
      ? parsed.offset
      : 0
  } catch {
    return 0
  }
}

export async function writeTelegramOffset(offset: number, file = TELEGRAM_STATE_FILE) {
  if (!Number.isInteger(offset) || offset < 0) throw new Error("Telegram offset must be positive.")
  await mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify({ offset }, null, 2))
  await rename(temp, file)
}
