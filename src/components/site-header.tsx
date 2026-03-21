import Link from "next/link"

const links = [
  { href: "/", label: "Home" },
  { href: "/rules", label: "Rules" },
  { href: "/submit", label: "Submit Entry" },
  { href: "/standings", label: "Standings" },
  { href: "/players", label: "Players" },
  { href: "/optimal", label: "Optimal Lineup" },
  { href: "/odds", label: "Win Probability" },
]

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Home Run Derby
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-neutral-700">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-neutral-900 hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
