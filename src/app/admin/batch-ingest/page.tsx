import { BatchIngestForm } from "./batch-ingest-form"

export const dynamic = "force-dynamic"

export default function AdminBatchIngestPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Batch Ingest</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Paste the corrected HRD batch payload, validate it, then commit once the preview is clean.
        </p>
      </div>
      <BatchIngestForm />
    </div>
  )
}
