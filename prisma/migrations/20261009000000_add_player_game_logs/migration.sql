-- CreateTable
CREATE TABLE "PlayerGameLog" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "gameDate" DATE NOT NULL,
    "teamId" INTEGER,
    "homeRuns" INTEGER NOT NULL DEFAULT 0,
    "atBats" INTEGER NOT NULL DEFAULT 0,
    "totalBases" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerGameLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerGameLog_seasonYear_gameDate_idx" ON "PlayerGameLog"("seasonYear", "gameDate");

-- CreateIndex
CREATE INDEX "PlayerGameLog_playerId_seasonYear_idx" ON "PlayerGameLog"("playerId", "seasonYear");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameLog_playerId_gamePk_key" ON "PlayerGameLog"("playerId", "gamePk");

-- AddForeignKey
ALTER TABLE "PlayerGameLog" ADD CONSTRAINT "PlayerGameLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "EntryOpeningProjectionSnapshot_entryId_scoringPeriodId_snapshot" RENAME TO "EntryOpeningProjectionSnapshot_entryId_scoringPeriodId_snap_key";

