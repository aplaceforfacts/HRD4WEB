import "./globals.css"
import { SiteHeader } from "@/components/site-header"

export const metadata = {
  title: "Home Run Derby",
  description: "Fantasy baseball home run competition",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">{children}</main>
      </body>
    </html>
  )
}
