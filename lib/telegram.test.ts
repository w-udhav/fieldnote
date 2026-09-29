import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { readTelegramOffset, writeTelegramOffset } from "./telegram-state"
import {
  extractTelegramLinkedInUrls,
  handleTelegramUpdate,
  parseTelegramAllowlist,
  telegramUpdateAllowed,
  type TelegramMessage,
} from "./telegram"

const message: TelegramMessage = {
  chat: { id: 1234 },
  from: { id: 5678 },
  text: "Please file https://www.linkedin.com/jobs/view/10 and https://lnkd.in/abc.",
}

test("parses numeric chat IDs and authorizes either the chat or sender", () => {
  const allowed = parseTelegramAllowlist("1234, -100998, nope")
  assert.deepEqual([...allowed], ["1234", "-100998"])
  assert.equal(telegramUpdateAllowed(message, allowed), true)
  assert.equal(telegramUpdateAllowed(message, new Set(["5678"])), true)
  assert.equal(telegramUpdateAllowed(message, new Set(["99"])), false)
})

test("extracts visible and hidden LinkedIn links without trailing punctuation", () => {
  assert.deepEqual(extractTelegramLinkedInUrls(message), [
    "https://www.linkedin.com/jobs/view/10",
    "https://lnkd.in/abc",
  ])
  assert.deepEqual(
    extractTelegramLinkedInUrls({
      chat: { id: 1 },
      text: "this company",
      entities: [{ type: "text_link", url: "https://linkedin.com/posts/example" }],
    }),
    ["https://linkedin.com/posts/example"]
  )
})

test("an unauthorized update is ignored without replying", async () => {
  let replies = 0
  const result = await handleTelegramUpdate(
    { update_id: 1, message },
    {
      allowedIds: new Set(["99"]),
      fileUrl: async () => {
        throw new Error("must not run")
      },
      reply: async () => {
        replies += 1
      },
    }
  )
  assert.equal(result, "unauthorized")
  assert.equal(replies, 0)
})

test("authorized links use the shared intake callback and return job IDs", async () => {
  const filed: string[] = []
  let reply = ""
  const result = await handleTelegramUpdate(
    { update_id: 2, message },
    {
      allowedIds: new Set(["1234"]),
      fileUrl: async (url) => {
        filed.push(url)
        return {
          reused: filed.length === 2,
          record: { id: "a237400d-8d57-4c24-ba4e-af82e13c2189", title: "Backend Engineer" },
        }
      },
      reply: async (_chatId, text) => {
        reply = text
      },
    }
  )
  assert.equal(result, "processed")
  assert.equal(filed.length, 2)
  assert.match(reply, /Filed: Backend Engineer \(Job ID A237400D\)/)
  assert.match(reply, /Updated: Backend Engineer/)
})

test("persists the next Telegram update offset atomically", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fieldnote-telegram-"))
  const file = path.join(directory, "state.json")
  try {
    assert.equal(await readTelegramOffset(file), 0)
    await writeTelegramOffset(42, file)
    assert.equal(await readTelegramOffset(file), 42)
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")), { offset: 42 })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
