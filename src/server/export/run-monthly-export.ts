import { DeliveryStatus, ExportStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isEmailConfigured, sendEmail } from "@/server/email/resend"
import { isPlaceholderEmail, siteUrl, unsubscribeToken } from "@/server/email/owner-email"
import { buildStandingsWorkbook } from "./build-standings-workbook"

/** Exports go out this long after a monthly period closes, once late games and stat corrections settle. */
export const EXPORT_DELAY_DAYS = 2
/** A period that closed longer ago than this is never auto-sent (e.g. when exports are first switched on). */
const AUTO_SEND_WINDOW_DAYS = 20
const MAX_ATTEMPTS = 3
/** Resend's default limit is 2 requests/second. */
const SEND_SPACING_MS = 600

const DAY_MS = 24 * 60 * 60 * 1000
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Monthly periods whose workbook is due today for leagues that have exports switched on. */
export async function findDueExports(now = new Date()) {
  const periods = await prisma.scoringPeriod.findMany({
    where: {
      periodType: "MONTHLY",
      endDate: {
        lte: new Date(now.getTime() - EXPORT_DELAY_DAYS * DAY_MS),
        gte: new Date(now.getTime() - AUTO_SEND_WINDOW_DAYS * DAY_MS),
      },
      season: { league: { monthlyExportEnabled: true } },
    },
    include: {
      exportRuns: { where: { dryRun: false } },
      season: { select: { id: true, year: true, league: { select: { slug: true } } } },
    },
  })

  return periods.filter((period) => period.exportRuns.every((run) => run.status !== ExportStatus.COMPLETED))
}

type RunOptions = {
  dryRun: boolean
  /** Stop starting new sends after this many milliseconds; a later run picks up the rest. */
  timeBudgetMs?: number
}

/**
 * Builds the workbook for a period and emails it to every owner with a team in the
 * season, one message per person covering all their teams. Safe to call repeatedly:
 * owners already sent to are skipped, failed sends are retried up to 3 times.
 */
export async function runMonthlyExport(seasonId: string, scoringPeriodId: string, options: RunOptions) {
  const started = Date.now()
  const timeBudgetMs = options.timeBudgetMs ?? 240_000

  if (!options.dryRun && !isEmailConfigured()) {
    throw new Error("Email isn't configured: set RESEND_API_KEY and EXPORT_FROM_EMAIL, or run a dry run.")
  }

  const workbook = await buildStandingsWorkbook(seasonId, scoringPeriodId)

  const run = await prisma.exportRun.upsert({
    where: { seasonId_scoringPeriodId_dryRun: { seasonId, scoringPeriodId, dryRun: options.dryRun } },
    update: { fileName: workbook.fileName, status: ExportStatus.SENDING, error: null },
    create: { seasonId, scoringPeriodId, dryRun: options.dryRun, fileName: workbook.fileName, status: ExportStatus.SENDING },
  })

  const [entries, scores, league] = await Promise.all([
    prisma.entry.findMany({
      where: { seasonId },
      select: { id: true, teamName: true, owner: { select: { id: true, name: true, email: true, emailOptOut: true } } },
    }),
    prisma.entryPeriodScore.findMany({
      where: {
        seasonId,
        scoringPeriod: { OR: [{ id: scoringPeriodId }, { periodType: "SEASON" }] },
      },
      select: { entryId: true, homeRuns: true, rank: true, isTied: true, scoringPeriod: { select: { periodType: true } } },
    }),
    prisma.league.findFirstOrThrow({ where: { seasons: { some: { id: seasonId } } } }),
  ])

  // Create a delivery row per owner the first time; later runs reuse them.
  const owners = new Map<string, (typeof entries)[number]["owner"]>()
  for (const entry of entries) owners.set(entry.owner.id, entry.owner)

  const existing = await prisma.exportDelivery.findMany({ where: { exportRunId: run.id }, select: { ownerId: true } })
  const known = new Set(existing.map((row) => row.ownerId))
  const fresh = [...owners.values()].filter((owner) => !known.has(owner.id))

  if (fresh.length > 0) {
    await prisma.exportDelivery.createMany({
      data: fresh.map((owner) => {
        const skip = owner.emailOptOut ? "Owner opted out." : isPlaceholderEmail(owner.email) ? "No real email on file." : null
        return {
          exportRunId: run.id,
          ownerId: owner.id,
          email: owner.email,
          status: skip ? DeliveryStatus.SKIPPED : DeliveryStatus.PENDING,
          error: skip,
        }
      }),
      skipDuplicates: true,
    })
  }

  const monthScore = new Map<string, (typeof scores)[number]>()
  const seasonScore = new Map<string, (typeof scores)[number]>()
  for (const score of scores) {
    ;(score.scoringPeriod.periodType === "SEASON" ? seasonScore : monthScore).set(score.entryId, score)
  }
  const teamsByOwner = new Map<string, typeof entries>()
  for (const entry of entries) teamsByOwner.set(entry.owner.id, [...(teamsByOwner.get(entry.owner.id) ?? []), entry])

  const leaders = [...monthScore.entries()]
    .map(([entryId, score]) => ({ team: entries.find((entry) => entry.id === entryId)?.teamName ?? "", ...score }))
    .sort((a, b) => b.homeRuns - a.homeRuns)
    .slice(0, 3)

  const pending = await prisma.exportDelivery.findMany({
    where: {
      exportRunId: run.id,
      OR: [{ status: DeliveryStatus.PENDING }, { status: DeliveryStatus.FAILED, attempts: { lt: MAX_ATTEMPTS } }],
    },
    include: { owner: true },
  })

  let sent = 0
  let failed = 0

  for (const delivery of pending) {
    if (Date.now() - started > timeBudgetMs) break

    const teams = (teamsByOwner.get(delivery.ownerId) ?? []).map((entry) => ({
      teamName: entry.teamName,
      month: monthScore.get(entry.id),
      season: seasonScore.get(entry.id),
    }))
    const message = composeMessage({
      leagueName: league.name,
      leagueSlug: league.slug,
      seasonYear: workbook.season.year,
      periodLabel: workbook.period.label,
      isFinal: workbook.isFinalPeriod,
      ownerName: delivery.owner.name,
      ownerId: delivery.ownerId,
      teams,
      leaders,
    })

    if (options.dryRun) {
      await prisma.exportDelivery.update({
        where: { id: delivery.id },
        data: { status: DeliveryStatus.DRY_RUN, attempts: { increment: 1 }, error: null, sentAt: new Date() },
      })
      sent += 1
      continue
    }

    try {
      const result = await sendEmail({
        to: delivery.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: league.commissionerEmail,
        attachments: [{ filename: workbook.fileName, content: workbook.buffer }],
        idempotencyKey: `export-${delivery.id}`,
      })
      await prisma.exportDelivery.update({
        where: { id: delivery.id },
        data: { status: DeliveryStatus.SENT, providerMessageId: result.id, attempts: { increment: 1 }, error: null, sentAt: new Date() },
      })
      sent += 1
    } catch (error) {
      await prisma.exportDelivery.update({
        where: { id: delivery.id },
        data: {
          status: DeliveryStatus.FAILED,
          attempts: { increment: 1 },
          error: error instanceof Error ? error.message.slice(0, 500) : "Unknown send error",
        },
      })
      failed += 1
    }

    await sleep(SEND_SPACING_MS)
  }

  const counts = await prisma.exportDelivery.groupBy({
    by: ["status"],
    where: { exportRunId: run.id },
    _count: { _all: true },
  })
  const remaining = await prisma.exportDelivery.count({
    where: {
      exportRunId: run.id,
      OR: [{ status: DeliveryStatus.PENDING }, { status: DeliveryStatus.FAILED, attempts: { lt: MAX_ATTEMPTS } }],
    },
  })

  await prisma.exportRun.update({
    where: { id: run.id },
    data:
      remaining === 0
        ? { status: ExportStatus.COMPLETED, completedAt: new Date() }
        : { status: ExportStatus.PENDING },
  })

  return {
    exportRunId: run.id,
    fileName: workbook.fileName,
    dryRun: options.dryRun,
    sentThisRun: sent,
    failedThisRun: failed,
    remaining,
    totals: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
  }
}

type TeamLine = {
  teamName: string
  month?: { homeRuns: number; rank: number | null; isTied: boolean }
  season?: { homeRuns: number; rank: number | null; isTied: boolean }
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function place(score?: { rank: number | null; isTied: boolean }) {
  if (!score?.rank) return "—"
  return `${score.isTied ? "T-" : ""}${score.rank}`
}

function composeMessage(input: {
  leagueName: string
  leagueSlug: string
  seasonYear: number
  periodLabel: string
  isFinal: boolean
  ownerName: string
  ownerId: string
  teams: TeamLine[]
  leaders: Array<{ team: string; homeRuns: number }>
}) {
  const site = siteUrl()
  const standingsUrl = `${site}/${input.leagueSlug}/standings`
  const unsubscribeUrl = `${site}/api/public/unsubscribe?o=${input.ownerId}&t=${unsubscribeToken(input.ownerId)}`
  const subject = input.isFinal
    ? `${input.seasonYear} ${input.leagueName}: final standings`
    : `${input.seasonYear} ${input.leagueName}: ${input.periodLabel} standings`

  const teamLines = input.teams.map(
    (team) =>
      `${team.teamName}: ${team.month?.homeRuns ?? 0} HR in ${input.periodLabel} (place ${place(team.month)}), ` +
      `${team.season?.homeRuns ?? 0} HR for the season (place ${place(team.season)})`,
  )
  const leaderLines = input.leaders.map((row, index) => `${index + 1}. ${row.team}: ${row.homeRuns} HR`)

  const text = [
    `Hi ${input.ownerName},`,
    "",
    `The ${input.periodLabel} standings workbook for the ${input.seasonYear} ${input.leagueName} is attached.`,
    "",
    ...teamLines,
    "",
    `${input.periodLabel} leaders:`,
    ...leaderLines,
    "",
    `Live standings: ${standingsUrl}`,
    "",
    `Stop these emails: ${unsubscribeUrl}`,
  ].join("\n")

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#18211c">
<p>Hi ${escapeHtml(input.ownerName)},</p>
<p>The ${escapeHtml(input.periodLabel)} standings workbook for the ${input.seasonYear} ${escapeHtml(input.leagueName)} is attached.</p>
<table style="border-collapse:collapse;margin:12px 0">
<tr><th align="left" style="padding:4px 12px 4px 0">Team</th><th align="right" style="padding:4px 12px">${escapeHtml(input.periodLabel)} HR</th><th align="right" style="padding:4px 12px">Place</th><th align="right" style="padding:4px 12px">Season HR</th><th align="right" style="padding:4px 0 4px 12px">Place</th></tr>
${input.teams
  .map(
    (team) =>
      `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(team.teamName)}</td><td align="right" style="padding:4px 12px">${team.month?.homeRuns ?? 0}</td><td align="right" style="padding:4px 12px">${place(team.month)}</td><td align="right" style="padding:4px 12px">${team.season?.homeRuns ?? 0}</td><td align="right" style="padding:4px 0 4px 12px">${place(team.season)}</td></tr>`,
  )
  .join("\n")}
</table>
<p><b>${escapeHtml(input.periodLabel)} leaders</b><br>${input.leaders.map((row, index) => `${index + 1}. ${escapeHtml(row.team)}: ${row.homeRuns} HR`).join("<br>")}</p>
<p><a href="${standingsUrl}">Live standings</a></p>
<p style="font-size:12px;color:#5b6760">You're getting this because you have a team in the ${escapeHtml(input.leagueName)}. <a href="${unsubscribeUrl}" style="color:#5b6760">Stop these emails</a>.</p>
</div>`

  return { subject, text, html }
}
