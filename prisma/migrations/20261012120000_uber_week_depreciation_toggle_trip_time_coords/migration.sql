-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "depreciationMethod" TEXT NOT NULL DEFAULT 'MILEAGE';
ALTER TABLE "Vehicle" ADD COLUMN "depreciationEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Vehicle" ADD COLUMN "mileageSensitivityPct" REAL;

-- a car that already carried a manual EGP/km override keeps behaving exactly
-- as before: the override is now an explicit method rather than a side effect
UPDATE "Vehicle" SET "depreciationMethod" = 'MANUAL' WHERE "depreciationPerKm" IS NOT NULL;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "durationMin" REAL;
ALTER TABLE "Trip" ADD COLUMN "pickupLat" REAL;
ALTER TABLE "Trip" ADD COLUMN "pickupLng" REAL;
ALTER TABLE "Trip" ADD COLUMN "dropoffLat" REAL;
ALTER TABLE "Trip" ADD COLUMN "dropoffLng" REAL;
