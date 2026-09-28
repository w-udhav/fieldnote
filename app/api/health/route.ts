import { deskPassword, isRequestAuthorized } from "@/lib/session"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return Response.json({
    authorized: isRequestAuthorized(request),
    lockRequired: Boolean(deskPassword()),
  })
}
