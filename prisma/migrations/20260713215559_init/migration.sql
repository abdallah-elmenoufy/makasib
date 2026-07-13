-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "plate" TEXT,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "startOdometer" REAL NOT NULL,
    "endOdometer" REAL,
    "startPhoto" TEXT,
    "endPhoto" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shift_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "shiftId" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'UBER',
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "distanceKm" REAL,
    "fare" REAL NOT NULL,
    "commission" REAL,
    "paymentType" TEXT NOT NULL DEFAULT 'CASH',
    "tip" REAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trip_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashTip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "shiftId" TEXT,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashTip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashTip_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FuelUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "odometer" REAL NOT NULL,
    "fuelType" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "pricePerUnit" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "fullTank" BOOLEAN NOT NULL DEFAULT true,
    "station" TEXT,
    "photo" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelUp_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "odometer" REAL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "cost" REAL NOT NULL,
    "photo" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Maintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "odometer" REAL,
    "isWork" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATETIME,
    "dueOdometer" REAL,
    "repeatKm" REAL,
    "repeatMonths" INTEGER,
    "lastDoneDate" DATETIME,
    "lastDoneOdometer" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reminder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
