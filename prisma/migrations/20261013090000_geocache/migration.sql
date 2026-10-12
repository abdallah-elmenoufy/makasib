-- CreateTable
CREATE TABLE "GeoCache" (
    "query" TEXT NOT NULL PRIMARY KEY,
    "lat" REAL,
    "lng" REAL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
