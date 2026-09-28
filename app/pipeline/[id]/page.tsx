import { RecordScreen } from "@/components/record-screen"

export default async function PipelineRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <RecordScreen id={id} />
}
