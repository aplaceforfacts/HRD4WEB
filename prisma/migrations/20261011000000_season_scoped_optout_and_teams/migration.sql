-- Seasons start fresh every year, so per-person state that should not carry over
-- moves onto the season.

-- Opt-out of the monthly workbook is per team/season instead of per person.
ALTER TABLE "Entry" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Entry" e SET "emailOptOut" = true FROM "Owner" o WHERE o."id" = e."ownerId" AND o."emailOptOut" = true;
ALTER TABLE "Owner" DROP COLUMN "emailOptOut";

-- Each season's pool remembers the team listed for the player that year.
ALTER TABLE "SeasonPlayerGroup" ADD COLUMN "teamCode" TEXT;
UPDATE "SeasonPlayerGroup" spg SET "teamCode" = p."mlbTeam" FROM "Player" p WHERE p."id" = spg."playerId";
