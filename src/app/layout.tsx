import "./globals.css"
import { SiteHeader } from "@/components/site-header"

export const metadata = {
  title: "Home Run Derby",
  description: "Fantasy baseball home run competition",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-indigo-100/40 via-transparent to-transparent" />
          <SiteHeader />
          <main className="app-shell relative">{children}</main>
        </div>
      </body>
    </html>
  )
}