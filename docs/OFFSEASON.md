# Running the Home Run Derby

How the app is put together after the 2026–27 offseason refactor, and the yearly
checklist. Everything here works for any league; `hrd` is the original league.

## How it fits together

- **League → Season → everything else.** A league (`/hrd`) has one season per MLB
  year. Groups, the player pool, scoring periods, entries and standings all belong
  to a season. Pages take the league from the URL and the season from `?season=YYYY`,
  defaulting to the newest season that isn't still in setup.
- **Teams and owners.** An entry is a team with its own `teamName`. Its owner is a
  person identified by email; one person can own several teams.
- **Scoring comes from MLB game logs.** The nightly sync (5 AM ET, `/api/admin/sync/run`)
  re-imports every pool player's regular-season game log into `PlayerGameLog`, then
  sums home runs by official game date for each period. That is how the league host
  counts, so the app and the host's workbook agree game for game. Re-importing fixes
  past months automatically (late-added players, corrected MLB IDs, missed sync days).
- **MLB IDs.** `ensure-provider-ids.ts` matches players to MLB IDs by exact name.
  When a name is ambiguous or a search picks the wrong person, add the verified ID to
  `PROVIDER_ID_OVERRIDES`; an override also corrects an ID that was stored wrongly.
- **Forecasts are recorded.** Each day the odds job stores every rostered player's
  forecast (`PlayerForecastSnapshot`, with injury status and model version), so the
  end-of-season prediction review no longer has to reconstruct anything.
- **Monthly workbook emails.** Two days after each month closes, the daily
  `/api/cron/monthly-export` job builds the host-format workbook (General-Prizes,
  Players, Picks, one tab per month, YTD) and emails it to every owner in leagues
  with monthly emails switched on: one email per person covering all their teams.
  Owners with placeholder addresses or who unsubscribed are skipped. Sends are
  logged per owner (`ExportRun` / `ExportDelivery`), so a run that times out or hits
  an error resumes the next day without double-sending.

## One-time setup for email

1. Create a Resend account and verify a sending domain.
2. In Vercel → Settings → Environment Variables add:
   - `RESEND_API_KEY`
   - `EXPORT_FROM_EMAIL`, e.g. `Home Run Derby <standings@yourdomain.com>`
   - `PUBLIC_SITE_URL`, e.g. `https://hrd-4-web.vercel.app` (links in the email)
   - optional `EXPORT_SIGNING_SECRET` for unsubscribe links (defaults to `CRON_SECRET`)
   - optional `ADMIN_SECRET` for the admin sign-in (defaults to `CRON_SECRET`)
3. Redeploy, sign in at `/admin`, open the season, and do a **Dry run** on a past
   month. Then switch on "Email the workbook to all owners automatically".

## Each new season

1. **Create the season** (pulls opening and closing day from MLB, copies last
   year's groups and prize sheet, builds the monthly periods):
   ```bash
   npx tsx scripts/setup-season.ts hrd 2027
   ```
   The season starts in **Setup**, so the site keeps showing 2026 until you open entries.
2. **Load the player pool and teams** from the host's workbook (dry run first):
   ```bash
   npx tsx scripts/import-host-workbook.ts hrd 2027 "2027 Home Run Derby.xlsx"
   npx tsx scripts/import-host-workbook.ts hrd 2027 "2027 Home Run Derby.xlsx" --commit
   ```
   Use `--pool-only` to load just the Players tab before picks exist. Re-running
   later only adds teams that aren't there yet.
3. **Projections and history** for the entry form and forecasts:
   ```bash
   npx tsx scripts/import-projections.ts 2027 path/to/steamer-2027-hitters.csv
   npx tsx scripts/backfill-historical-stats.ts 2025 2026
   ```
4. **Run a sync** (`/admin/sync`, year 2027) so new players get MLB IDs. Fix any
   "ambiguous/no match" names from the log with an override.
5. **Owner emails:** on `/admin/hrd/2027`, paste `Team, Owner, email` lines.
   Self-service entries already include an email.
6. **Open entries** on the admin season page (or lock them after the deadline).
   Opening entries makes 2027 the default season on the public site.

Everything takes a year argument. Nothing in `src/` hardcodes a season.

## A new league

```bash
npx tsx scripts/setup-season.ts office-derby 2027 "Office Home Run Derby"
```
It gets its own URL (`/office-derby`), groups (A–L + M by default), entries, emails
and prize sheet, and shares MLB data with every other league.

Not built yet: commissioners still share one admin sign-in. Per-league commissioner
logins (magic-link email through Resend) are the next step if other people start
running leagues.

## Useful commands

```bash
npm test                                                     # unit tests
npx tsx scripts/run-sync.ts 2026                             # the nightly pipeline, by hand
npx tsx scripts/export-workbook.ts hrd 2026 Season out.xlsx  # build a workbook without emailing
```

## Roadmap

- **UI refresh with Arc UI (uiarc.dev).** The app is Next.js 15 + React 19 +
  Tailwind 3, which is what Arc UI targets. It needs `shadcn init` and Motion
  first, and Arc's CSS variables mapped to the app's palette. Good candidates:
  - standings, roster and gap tables → Arc's sortable data table (animated reorder)
  - team stat cards → metric cards with animated counters and sparklines
  - period tabs → Arc tabs or segmented control
  - player pickers and team search → combobox and multi-select
  - entry form fields → Arc inputs and number fields
  - (Pro) race bar chart to replay the season standings
  Start with `/[league]/standings` on a branch; keep motion light on dense tables.
- Per-league commissioner sign-in (see above).
- An in-app prediction-accuracy page built on `PlayerForecastSnapshot`.
