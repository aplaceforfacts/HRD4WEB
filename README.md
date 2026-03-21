# Home Run Derby

A Next.js + Prisma starter project for your fantasy baseball Home Run Derby format.

## Included
- public entry submission flow
- season/group schema
- scoring periods seeded for 2026
- CSV snapshot upload
- standings and category pages
- optimal lineup view
- team detail page with gap-to-optimal
- win probability page
- owner/team lookup search

## Getting started

1. Copy `.env.example` to `.env`
2. Run `npm install`
3. Run `npx prisma generate`
4. Run `npx prisma migrate dev`
5. Run `npm run prisma:seed`
6. Run `npm run import:player-sheet:2026`
7. Run `npm run dev`

## Important notes

### Player sheet
The included `src/data/season-2026-player-sheet.ts` only contains a short seed sample so the package stays lightweight.
Replace it with your full 2026 A–M dataset before production use.

### Admin routes
The admin sync and snapshot upload endpoints are not protected in this starter.
Before production deployment, add commissioner auth or a shared secret.

### Win probability
The odds page uses a simple Monte Carlo model based on current totals plus remaining projected HR.
It is useful for engagement, but should be presented as directional, not authoritative.

## Suggested deployment
- Vercel
- Neon Postgres
- Prisma migrations
- nightly cron to `/api/admin/sync/run`

## Example snapshot CSV

```csv
player_name,team,home_runs,at_bats,slugging_pct,snapshot_date
Aaron Judge,NYY,3,20,0.600,2026-03-28
Shohei Ohtani,LAD,2,18,0.550,2026-03-28
```
