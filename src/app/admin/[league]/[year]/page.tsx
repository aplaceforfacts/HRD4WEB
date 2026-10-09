import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { SeasonStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/server/admin/require-admin"
import { importOwnerEmails } from "@/server/admin/import-owner-emails"
import { isEmailConfigured } from "@/server/email/resend"
import { isPlaceholderEmail } from "@/server/email/owner-email"
import { EXPORT_DELAY_DAYS, runMonthlyExport } from "@/server/export/run-monthly-export"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type PageProps = {
  params: Promise<{ league: string; year: string }>
  searchParams: Promise<{ notice?: string }>
}

function back(leagueSlug: string, year: number, notice: string): never {
  redirect(`/admin/${leagueSlug}/${year}?notice=${encodeURIComponent(notice)}`)
}

async function setEntryStatus(form: FormData) {
  "use server"
  await requireAdmin()
  const seasonId = String(form.get("seasonId"))
  const status = String(form.get("status")) as SeasonStatus
  if (!Object.values(SeasonStatus).includes(status)) throw new Error("Unknown status.")
  const season = await prisma.season.update({
    where: { id: seasonId },
    data: { entryStatus: status },
    include: { league: true },
  })
  back(season.league.slug, season.year, `Entries are now ${status.toLowerCase()}.`)
}

async function saveSettings(form: FormData) {
  "use server"
  await requireAdmin()
  const seasonId = String(form.get("seasonId"))
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId }, include: { league: true } })
  const commissionerEmail = String(form.get("commissionerEmail") ?? "").trim() || null

  await prisma.$transaction([
    prisma.league.update({
      where: { id: season.leagueId },
      data: {
        name: String(form.get("leagueName") ?? season.league.name).trim() || season.league.name,
        commissionerName: String(form.get("commissionerName") ?? "").trim() || null,
        commissionerEmail,
        monthlyExportEnabled: form.get("monthlyExportEnabled") === "on",
      },
    }),
    prisma.season.update({
      where: { id: seasonId },
      data: { prizesText: String(form.get("prizesText") ?? "").replace(/\r\n/g, "\n").trimEnd() || null },
    }),
  ])
  back(season.league.slug, season.year, "Settings saved.")
}

async function saveOwners(form: FormData) {
  "use server"
  await requireAdmin()
  const seasonId = String(form.get("seasonId"))
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId }, include: { league: true } })
  const result = await importOwnerEmails(seasonId, String(form.get("owners") ?? ""))
  const problems = [
    result.unknownTeams.length ? `No team named: ${result.unknownTeams.join("; ")}.` : "",
    result.invalidLines.length ? `Couldn't read ${result.invalidLines.length} line(s).` : "",
  ]
    .filter(Boolean)
    .join(" ")
  revalidatePath(`/admin/${season.league.slug}/${season.year}`)
  back(season.league.slug, season.year, `Owner emails: ${result.updated} updated, ${result.unchanged} already set. ${problems}`)
}

async function sendExport(form: FormData) {
  "use server"
  await requireAdmin()
  const periodId = String(form.get("periodId"))
  const dryRun = form.get("mode") !== "live"
  const period = await prisma.scoringPeriod.findUniqueOrThrow({
    where: { id: periodId },
    include: { season: { include: { league: true } } },
  })
  const result = await runMonthlyExport(period.seasonId, period.id, { dryRun, timeBudgetMs: 240_000 })
  const summary = Object.entries(result.totals)
    .map(([status, count]) => `${count} ${status.toLowerCase().replace("_", " ")}`)
    .join(", ")
  back(
    period.season.league.slug,
    period.season.year,
    `${dryRun ? "Dry run" : "Send"} for ${period.label}: ${summary}.${result.remaining ? ` ${result.remaining} still to send; run it again or let tomorrow's cron finish.` : ""}`,
  )
}

export default async function AdminSeasonPage({ params, searchParams }: PageProps) {
  const { league: leagueSlug, year } = await params
  const { notice } = await searchParams

  const season = await prisma.season.findFirst({
    where: { year: Number(year), league: { slug: leagueSlug } },
    include: {
      league: true,
      scoringPeriods: {
        orderBy: { sortOrder: "asc" },
        include: {
          exportRuns: {
            include: { deliveries: { select: { status: true } } },
            orderBy: { startedAt: "desc" },
          },
        },
      },
      entries: {
        orderBy: { teamName: "asc" },
        include: { owner: true },
      },
    },
  })

  if (!season) notFound()

  const realEmails = season.entries.filter((entry) => !isPlaceholderEmail(entry.owner.email)).length
  const ownerCount = new Set(season.entries.map((entry) => entry.ownerId)).size
  const emailReady = isEmailConfigured()
  const now = Date.now()

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          ← All leagues
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          {season.league.name} · {season.year}
        </h1>
        <p className="text-sm text-neutral-600">
          {season.entries.length} teams · {ownerCount} owners · {realEmails} of {season.entries.length} teams have a real
          owner email · entries {season.entryStatus.toLowerCase()} ·{" "}
          <Link href={`/${season.league.slug}?season=${season.year}`} className="underline">
            public site
          </Link>
        </p>
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Monthly workbook emails</h2>
        <p className="max-w-3xl text-sm text-neutral-600">
          When switched on, every owner gets the standings workbook {EXPORT_DELAY_DAYS} days after each month closes, one
          email per person covering all their teams. Teams still on a placeholder address are skipped.
          {emailReady
            ? " Email sending is configured."
            : " Email isn't configured yet: set RESEND_API_KEY and EXPORT_FROM_EMAIL in Vercel. Dry runs and downloads work now."}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4">Closes</th>
                <th className="py-2 pr-4">Last send</th>
                <th className="py-2 pr-4">Workbook</th>
                <th className="py-2">Send</th>
              </tr>
            </thead>
            <tbody>
              {season.scoringPeriods
                .filter((period) => period.periodType === "MONTHLY")
                .map((period) => {
                  const live = period.exportRuns.find((run) => !run.dryRun)
                  const dry = period.exportRuns.find((run) => run.dryRun)
                  const describe = (run: typeof live) => {
                    if (!run) return null
                    const counts: Record<string, number> = {}
                    for (const delivery of run.deliveries) counts[delivery.status] = (counts[delivery.status] ?? 0) + 1
                    return `${run.status.toLowerCase()} · ${Object.entries(counts)
                      .map(([status, count]) => `${count} ${status.toLowerCase().replace("_", " ")}`)
                      .join(", ")}`
                  }
                  const closed = period.endDate.getTime() <= now
                  return (
                    <tr key={period.id} className="border-b border-neutral-100 align-top last:border-0">
                      <td className="py-3 pr-4 font-medium">{period.label}</td>
                      <td className="py-3 pr-4 text-neutral-600">{period.endDate.toDateString()}</td>
                      <td className="py-3 pr-4 text-neutral-600">
                        {describe(live) ?? "Not sent"}
                        {dry ? <div className="text-xs text-neutral-400">Dry run: {describe(dry)}</div> : null}
                      </td>
                      <td className="py-3 pr-4">
                        <a className="underline" href={`/api/admin/export/workbook?periodId=${period.id}`}>
                          Download .xlsx
                        </a>
                      </td>
                      <td className="py-3">
                        <form action={sendExport} className="flex flex-wrap gap-2">
                          <input type="hidden" name="periodId" value={period.id} />
                          <button name="mode" value="dry" className="rounded-lg border border-neutral-300 px-3 py-1.5">
                            Dry run
                          </button>
                          <button
                            name="mode"
                            value="live"
                            disabled={!emailReady || !closed}
                            title={!closed ? "This period hasn't closed yet." : undefined}
                            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-white disabled:opacity-40"
                          >
                            {live ? "Resume / resend failed" : "Send now"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <form action={saveSettings} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">League settings</h2>
          <input type="hidden" name="seasonId" value={season.id} />
          <label className="block space-y-1 text-sm">
            <span className="font-medium">League name</span>
            <input id="league-name" name="leagueName" defaultValue={season.league.name} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Commissioner</span>
              <input id="commissioner-name" name="commissionerName" defaultValue={season.league.commissionerName ?? ""} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Commissioner email (replies go here)</span>
              <input id="commissioner-email" name="commissionerEmail" type="email" defaultValue={season.league.commissionerEmail ?? ""} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input id="monthly-export-enabled" type="checkbox" name="monthlyExportEnabled" defaultChecked={season.league.monthlyExportEnabled} />
            Email the workbook to all owners automatically each month
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Prize sheet text ({season.year}), one line per row</span>
            <textarea id="prizes-text" name="prizesText" rows={10} defaultValue={season.prizesText ?? ""} className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs" />
          </label>
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Save settings</button>
        </form>

        <div className="space-y-6">
          <form action={setEntryStatus} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Entries</h2>
            <input type="hidden" name="seasonId" value={season.id} />
            <p className="text-sm text-neutral-600">Currently {season.entryStatus.toLowerCase()}.</p>
            <div className="flex flex-wrap gap-2">
              {Object.values(SeasonStatus).map((status) => (
                <button
                  key={status}
                  name="status"
                  value={status}
                  disabled={status === season.entryStatus}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:bg-neutral-900 disabled:text-white"
                >
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </form>

          <form action={saveOwners} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Owner emails</h2>
            <input type="hidden" name="seasonId" value={season.id} />
            <p className="text-sm text-neutral-600">
              Paste one team per line: <code>Team name, Owner name, email</code>. Tabs work too, so you can copy three
              columns straight from a spreadsheet. Give every team one person owns the same email.
            </p>
            <textarea id="owner-lines" name="owners" rows={8} placeholder={"Snoopy#1, Pat Smith, pat@example.com\nSnoopy#2, Pat Smith, pat@example.com"} className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs" />
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Save owner emails</button>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Teams</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-4 py-2">Team</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Email</th>
              </tr>
            </thead>
            <tbody>
              {season.entries.map((entry) => {
                const placeholder = isPlaceholderEmail(entry.owner.email)
                return (
                  <tr key={entry.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 font-medium">{entry.teamName}</td>
                    <td className="px-4 py-2">{entry.owner.name}</td>
                    <td className="px-4 py-2">
                      {placeholder ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Needs email</span>
                      ) : (
                        <>
                          {entry.owner.email}
                          {entry.owner.emailOptOut ? (
                            <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">Opted out</span>
                          ) : null}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
