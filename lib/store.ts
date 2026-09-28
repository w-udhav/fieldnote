import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { BriefRecord } from "./types"

const FILE = path.join(process.cwd(), "data", "records.json")

let queue: Promise<unknown> = Promise.resolve()

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function readAll(): Promise<BriefRecord[]> {
  try {
    const raw = await readFile(FILE, "utf8")
    const parsed = JSON.parse(raw) as BriefRecord[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((record) => ({
      ...record,
      sentMessageId: record.sentMessageId ?? null,
    }))
  } catch {
    return []
  }
}

async function writeAll(records: BriefRecord[]) {
  await mkdir(path.dirname(FILE), { recursive: true })
  const temp = `${FILE}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(records, null, 2))
  await rename(temp, FILE)
}

export function listRecords() {
  return withLock(async () => {
    const records = await readAll()
    return records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  })
}

export function getRecord(id: string) {
  return withLock(async () => {
    const records = await readAll()
    return records.find((record) => record.id === id) ?? null
  })
}

export function findOpenByUrl(finalUrl: string) {
  return withLock(async () => {
    const records = await readAll()
    return (
      records.find((record) => record.finalUrl === finalUrl && record.status !== "sent") ?? null
    )
  })
}

export function saveRecord(record: BriefRecord) {
  return withLock(async () => {
    const records = await readAll()
    const index = records.findIndex((item) => item.id === record.id)
    if (index >= 0) records[index] = record
    else records.push(record)
    await writeAll(records)
    return record
  })
}

export function removeRecord(id: string) {
  return withLock(async () => {
    const records = await readAll()
    const next = records.filter((record) => record.id !== id)
    if (next.length === records.length) return false
    await writeAll(next)
    return true
  })
}
