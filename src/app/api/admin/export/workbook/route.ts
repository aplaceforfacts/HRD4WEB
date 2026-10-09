import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildStandingsWorkbook } from "@/server/export/build-standings-workbook"

export const dynamic = "force-dynamic"

// Auth is enforced by src/middleware.ts.
export async function GET(request: NextRequest) {
  const periodId = request.nextUrl.searchParams.get("periodId") ?? ""
  const period = await prisma.scoringPeriod.findUnique({ where: { id: periodId }, select: { id: true, seasonId: true } })
  if (!period) return NextResponse.json({ ok: false, message: "Unknown period." }, { status: 404 })

  const workbook = await buildStandingsWorkbook(period.seasonId, period.id)

  return new NextResponse(new Uint8Array(workbook.buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${workbook.fileName.replace(/"/g, "")}"`,
    },
  })
}
