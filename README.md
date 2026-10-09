# Home Run Derby

A Next.js + Prisma starter project for your fantasy baseball Home Run Derby format.

## What it does
- League-scoped public site: `/{league}` standings, monthly races, player rankings,
  optimal lineups, win odds and team pages, with past seasons via `?season=YYYY`
- Scoring straight from MLB StatsAPI game logs, refreshed nightly
- Self-service entry form (team name + owner email) or import from the host's workbook
- Monthly standings workbook emailed to every owner (Resend)
- Admin at `/admin`: league settings, owner emails, entry status, exports, sync

See [docs/OFFSEASON.md](docs/OFFSEASON.md) for how it works and the yearly checklist.

## Getting started (local)

1. Copy `.env.example` to `.env` and point `DATABASE_URL` at a Postgres database
2. `npm install`
3. `npx prisma migrate deploy`
4. `npm run prisma:seed` (sets up league `hrd` for the current MLB season)
5. `npm run dev`, then `npm test`
