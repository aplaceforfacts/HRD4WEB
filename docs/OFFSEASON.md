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

## Every season starts fresh

Each year has new owners and a new player pool. Only the league's format (groups and
how many picks each takes) and a draft of the prize sheet carry over. Specifically:

- Teams, owners' entries, the pool, standings and exports all belong to one season.
- An owner is just an email; unsubscribing covers that season only, so someone who
  rejoins next year gets the emails again.
- Each season's pool keeps the team printed on that year's host sheet, so an old
  season's workbook still reads the way the host sent it, even after trades.
- MLB data (a player's MLB ID, game logs, projections) is shared across years. When
  the importer sees a name it already knows, it reuses that player if the team
  matches, or if MLB has only one player by that name (he moved clubs). When MLB has
  several players by that name and none on the listed team, the dry run lists them
  under `namesakesToReview` with their MLB IDs: add the right one to
  `PROVIDER_ID_OVERRIDES` before the season starts, or he'll score 0.

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

- **Arc UI (uiarc.dev).** Shipped 2026-10-10 on standings, team, player rankings,
  optimal lineup and win probability pages: sortable tables (`SortableDataTable`),
  metric cards with rolling counters, and a segmented period switcher. Arc's files
  live in `src/components/arc/`. `components.json` is hand-written so
  `npx shadcn@latest add @uiarc/<name>` only adds Arc files. Tables reorder columns
  below 620px (`usePhoneLayout`) so each phone row reads "place, name … HR".
  Left to do before entries open in March: the entry form's player pickers
  (Arc combobox / multi-select) and the home page. Win-probability cards have
  only been seen without live odds; check them on opening day.
  Optional: Arc Pro's race bar chart to replay the season standings.
- Per-league commissioner sign-in (see above).
- An in-app prediction-accuracy page built on `PlayerForecastSnapshot`.
