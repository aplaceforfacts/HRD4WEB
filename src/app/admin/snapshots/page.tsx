"use client"

import { useState } from "react"

export default function SnapshotUploadPage() {
  const [text, setText] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  async function handleUpload() {
    setMessage(null)

    const res = await fetch("/api/admin/snapshots/upload", {
      method: "POST",
      body: text,
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.message || "Upload failed")
    } else {
      setMessage(`Imported ${data.imported} rows`)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Upload Snapshot CSV</h1>

      <textarea
        className="min-h-[240px] w-full rounded-xl border border-neutral-300 p-3"
        placeholder="Paste CSV here"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button className="rounded-xl bg-black px-4 py-2 text-white" onClick={handleUpload}>
        Upload
      </button>

      {message && <p>{message}</p>}
    </div>
  )
}
