export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next = "/admin", error } = await searchParams

  return (
    <form method="post" action="/api/admin/login" className="mx-auto max-w-sm space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">Admin sign-in</h1>
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-2">
        <span className="text-sm font-medium text-neutral-700">Admin secret</span>
        <input
          id="admin-secret"
          name="secret"
          type="password"
          required
          autoFocus
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-sm text-red-700">That secret didn&apos;t match. Try again.</p> : null}
      <button className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white">Sign in</button>
    </form>
  )
}
