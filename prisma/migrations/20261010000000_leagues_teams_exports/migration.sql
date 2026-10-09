-- Leagues, team names on entries, forecast history and monthly export tracking.
-- Existing data moves into one league ("hrd"); each entry's team name is copied
-- from its owner record, which is where the team name lived until now.

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'SENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DRY_RUN', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'America/New_York',
    "commissionerName" TEXT,
    "commissionerEmail" TEXT,
    "monthlyExportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");

INSERT INTO "League" ("id", "slug", "name", "updatedAt")
VALUES ('league_hrd', 'hrd', 'Home Run Derby', CURRENT_TIMESTAMP);

-- Season belongs to a league; the year is unique per league, not globally.
DROP INDEX "Season_year_key";
ALTER TABLE "Season" ADD COLUMN "leagueId" TEXT, ADD COLUMN "prizesText" TEXT;
UPDATE "Season" SET "leagueId" = 'league_hrd';
ALTER TABLE "Season" ALTER COLUMN "leagueId" SET NOT NULL;
CREATE UNIQUE INDEX "Season_leagueId_year_key" ON "Season"("leagueId", "year");
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The 2026 workbook's prize sheet, so the first export matches the host's file.
UPDATE "Season" SET "prizesText" = E'Welcome to the 2026 Home Run Derby!\nYEAR PRIZES\n1st Prize: $1100\n2nd Prize: $640\n3rd Prize: $320\n4th Prize: $170\n5th Prize: $70\n6th Prize: $50\nLast Place: $10\n\nMonthly Prizes\n1st Prize: $140\n2nd Prize: $40\n\nExcel Maintenance: $160'
WHERE "year" = 2026 AND "leagueId" = 'league_hrd';

-- A person can own several teams; the team name moves onto the entry.
DROP INDEX "Entry_seasonId_ownerId_key";
ALTER TABLE "Entry" ADD COLUMN "teamName" TEXT;
UPDATE "Entry" e SET "teamName" = o."name" FROM "Owner" o WHERE o."id" = e."ownerId";
ALTER TABLE "Entry" ALTER COLUMN "teamName" SET NOT NULL;
CREATE UNIQUE INDEX "Entry_seasonId_teamName_key" ON "Entry"("seasonId", "teamName");
CREATE INDEX "Entry_seasonId_ownerId_idx" ON "Entry"("seasonId", "ownerId");

ALTER TABLE "Owner" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;

-- Two MLB players can share a name; the MLB ID is the identity.
DROP INDEX "Player_fullName_key";

-- CreateTable
CREATE TABLE "PlayerForecastSnapshot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "scoringPeriodId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "currentHomeRuns" INTEGER NOT NULL,
    "expectedRemainingHomeRuns" DOUBLE PRECISION NOT NULL,
    "availability" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerForecastSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlayerForecastSnapshot_scoringPeriodId_snapshotDate_idx" ON "PlayerForecastSnapshot"("scoringPeriodId", "snapshotDate");
CREATE UNIQUE INDEX "PlayerForecastSnapshot_playerId_scoringPeriodId_snapshotDat_key" ON "PlayerForecastSnapshot"("playerId", "scoringPeriodId", "snapshotDate");
ALTER TABLE "PlayerForecastSnapshot" ADD CONSTRAINT "PlayerForecastSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerForecastSnapshot" ADD CONSTRAINT "PlayerForecastSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerForecastSnapshot" ADD CONSTRAINT "PlayerForecastSnapshot_scoringPeriodId_fkey" FOREIGN KEY ("scoringPeriodId") REFERENCES "ScoringPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ExportRun" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "scoringPeriodId" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExportRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExportRun_seasonId_scoringPeriodId_dryRun_key" ON "ExportRun"("seasonId", "scoringPeriodId", "dryRun");
ALTER TABLE "ExportRun" ADD CONSTRAINT "ExportRun_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportRun" ADD CONSTRAINT "ExportRun_scoringPeriodId_fkey" FOREIGN KEY ("scoringPeriodId") REFERENCES "ScoringPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ExportDelivery" (
    "id" TEXT NOT NULL,
    "exportRunId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExportDelivery_exportRunId_status_idx" ON "ExportDelivery"("exportRunId", "status");
CREATE UNIQUE INDEX "ExportDelivery_exportRunId_ownerId_key" ON "ExportDelivery"("exportRunId", "ownerId");
ALTER TABLE "ExportDelivery" ADD CONSTRAINT "ExportDelivery_exportRunId_fkey" FOREIGN KEY ("exportRunId") REFERENCES "ExportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportDelivery" ADD CONSTRAINT "ExportDelivery_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
