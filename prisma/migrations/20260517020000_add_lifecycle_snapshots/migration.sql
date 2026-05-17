-- CreateTable
CREATE TABLE "EntryStandingSnapshot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "scoringPeriodId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "homeRuns" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL,
    "isTied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryStandingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryOpeningProjectionSnapshot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "scoringPeriodId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "projectedHomeRuns" DOUBLE PRECISION NOT NULL,
    "projectionSource" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryOpeningProjectionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntryStandingSnapshot_entryId_scoringPeriodId_snapshotDate_key" ON "EntryStandingSnapshot"("entryId", "scoringPeriodId", "snapshotDate");

-- CreateIndex
CREATE INDEX "EntryStandingSnapshot_scoringPeriodId_snapshotDate_idx" ON "EntryStandingSnapshot"("scoringPeriodId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "EntryOpeningProjectionSnapshot_entryId_scoringPeriodId_snapshotDate_key" ON "EntryOpeningProjectionSnapshot"("entryId", "scoringPeriodId", "snapshotDate");

-- CreateIndex
CREATE INDEX "EntryOpeningProjectionSnapshot_scoringPeriodId_snapshotDate_idx" ON "EntryOpeningProjectionSnapshot"("scoringPeriodId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "EntryStandingSnapshot" ADD CONSTRAINT "EntryStandingSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryStandingSnapshot" ADD CONSTRAINT "EntryStandingSnapshot_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryStandingSnapshot" ADD CONSTRAINT "EntryStandingSnapshot_scoringPeriodId_fkey" FOREIGN KEY ("scoringPeriodId") REFERENCES "ScoringPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryOpeningProjectionSnapshot" ADD CONSTRAINT "EntryOpeningProjectionSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryOpeningProjectionSnapshot" ADD CONSTRAINT "EntryOpeningProjectionSnapshot_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryOpeningProjectionSnapshot" ADD CONSTRAINT "EntryOpeningProjectionSnapshot_scoringPeriodId_fkey" FOREIGN KEY ("scoringPeriodId") REFERENCES "ScoringPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
