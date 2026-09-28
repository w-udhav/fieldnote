import type { BriefRecord, PublicSettings } from "./types"

export class ApiError extends Error {
  status: number
  record?: BriefRecord

  constructor(message: string, status: number, record?: BriefRecord) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.record = record
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const key = window.sessionStorage.getItem("fieldnote-key") ?? ""
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "x-fieldnote-key": key } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const data = (await response.json().catch(() => ({}))) as {
    error?: string
    record?: BriefRecord
  }
  if (!response.ok) {
    throw new ApiError(data.error || "Request failed.", response.status, data.record)
  }
  return data as T
}

export type { PublicSettings }
