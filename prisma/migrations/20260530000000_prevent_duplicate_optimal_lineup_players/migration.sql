-- Remove any existing duplicate player rows inside the same optimal lineup before
-- enforcing uniqueness. Keep the earliest persisted row for each player.
WITH ranked_duplicates AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "optimalLineupId", "playerId"
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS row_number
    FROM "OptimalLineupPlayer"
)
DELETE FROM "OptimalLineupPlayer"
WHERE "id" IN (
    SELECT "id"
    FROM ranked_duplicates
    WHERE row_number > 1
);

-- Keep stored optimal totals consistent with the deduped player rows.
UPDATE "OptimalLineup"
SET
    "totalHomeRuns" = COALESCE((
        SELECT SUM("homeRuns")
        FROM "OptimalLineupPlayer"
        WHERE "OptimalLineupPlayer"."optimalLineupId" = "OptimalLineup"."id"
    ), 0),
    "updatedAt" = CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "OptimalLineupPlayer_optimalLineupId_playerId_key" ON "OptimalLineupPlayer"("optimalLineupId", "playerId");
