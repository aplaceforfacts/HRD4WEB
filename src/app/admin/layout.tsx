import Link from "next/link"

export const dynamic = "force-dynamic"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link href="/admin" className="text-xl font-semibold tracking-tight">
            Home Run Derby admin
          </Link>
          <nav className="flex gap-4 text-sm text-neutral-700">
            <Link href="/admin" className="hover:underline">Leagues</Link>
            <Link href="/admin/sync" className="hover:underline">Sync</Link>
            <Link href="/" className="hover:underline">Public site</Link>
          </nav>
        </div>
      </header>
      <main className="app-shell relative">{children}</main>
    </>
  )
}
