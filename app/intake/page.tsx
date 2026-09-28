import { redirect } from "next/navigation"

export default function IntakePage() {
  redirect("/pipeline?paste=open")
}
