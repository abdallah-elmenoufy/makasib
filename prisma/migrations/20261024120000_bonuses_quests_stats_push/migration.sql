-- Bonuses apart from tips
ALTER TABLE "CashTip" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TIP';

-- Why a shift ended
ALTER TABLE "Shift" ADD COLUMN "endReason" TEXT;

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'UBER',
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "tiers" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'UBER',
    "rating" REAL,
    "acceptanceRate" REAL,
    "cancellationRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformStat_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSentAt" DATETIME
);

-- CreateTable
CREATE TABLE "NotifyLog" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformStat_vehicleId_weekKey_platform_key" ON "PlatformStat"("vehicleId", "weekKey", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- Backfill: statement promotions/quests/boosts imported before bonuses had their own kind
UPDATE "CashTip" SET "kind" = 'BONUS' WHERE "kind" = 'TIP' AND (lower("notes") LIKE '%promotion%' OR lower("notes") LIKE '%quest%' OR lower("notes") LIKE '%boost%' OR lower("notes") LIKE '%incentive%');
