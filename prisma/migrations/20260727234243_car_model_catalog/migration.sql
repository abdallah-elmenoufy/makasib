-- CreateTable
CREATE TABLE "CarModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "category" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "plate" TEXT,
    "carModelId" TEXT,
    "fuelSetup" TEXT NOT NULL DEFAULT 'PETROL',
    "ownership" TEXT NOT NULL DEFAULT 'OWNED',
    "purchasePrice" REAL,
    "estimatedValue" REAL,
    "monthlyInstallment" REAL,
    "dailyRentalFee" REAL,
    "targetOwnerShare" REAL,
    "depreciationPerKm" REAL,
    "initialOdometer" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_carModelId_fkey" FOREIGN KEY ("carModelId") REFERENCES "CarModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Vehicle" ("createdAt", "dailyRentalFee", "depreciationPerKm", "estimatedValue", "fuelSetup", "id", "initialOdometer", "isActive", "make", "model", "monthlyInstallment", "name", "notes", "ownership", "plate", "purchasePrice", "targetOwnerShare", "year") SELECT "createdAt", "dailyRentalFee", "depreciationPerKm", "estimatedValue", "fuelSetup", "id", "initialOdometer", "isActive", "make", "model", "monthlyInstallment", "name", "notes", "ownership", "plate", "purchasePrice", "targetOwnerShare", "year" FROM "Vehicle";
DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CarModel_make_model_key" ON "CarModel"("make", "model");
