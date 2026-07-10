-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Premises" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "floor" INTEGER,
    "areaM2" DECIMAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Premises_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "taxCode" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "premisesId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "rentKop" INTEGER NOT NULL,
    "garbageKop" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lease_premisesId_fkey" FOREIGN KEY ("premisesId") REFERENCES "Premises" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "effectiveFrom" DATETIME NOT NULL,
    "electricityRateKop" INTEGER NOT NULL,
    "waterRateKop" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "premisesId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "electricity" DECIMAL NOT NULL,
    "water" DECIMAL NOT NULL,
    "electricityReplaced" BOOLEAN NOT NULL DEFAULT false,
    "electricityReplacedInitial" DECIMAL,
    "waterReplaced" BOOLEAN NOT NULL DEFAULT false,
    "waterReplacedInitial" DECIMAL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeterReading_premisesId_fkey" FOREIGN KEY ("premisesId") REFERENCES "Premises" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaseId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "electricityRateKop" INTEGER NOT NULL,
    "waterRateKop" INTEGER NOT NULL,
    "prevElectricity" DECIMAL NOT NULL,
    "currElectricity" DECIMAL NOT NULL,
    "electricityUsed" DECIMAL NOT NULL,
    "prevWater" DECIMAL NOT NULL,
    "currWater" DECIMAL NOT NULL,
    "waterUsed" DECIMAL NOT NULL,
    "rentKop" INTEGER NOT NULL,
    "electricityKop" INTEGER NOT NULL,
    "waterKop" INTEGER NOT NULL,
    "garbageKop" INTEGER NOT NULL,
    "totalKop" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaseId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amountKop" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Premises_locationId_unitNumber_key" ON "Premises"("locationId", "unitNumber");

-- CreateIndex
CREATE INDEX "Lease_premisesId_startDate_idx" ON "Lease"("premisesId", "startDate");

-- CreateIndex
CREATE INDEX "Lease_tenantId_idx" ON "Lease"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_effectiveFrom_key" ON "Tariff"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_premisesId_year_month_key" ON "MeterReading"("premisesId", "year", "month");

-- CreateIndex
CREATE INDEX "Invoice_year_month_idx" ON "Invoice"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_leaseId_year_month_key" ON "Invoice"("leaseId", "year", "month");

-- CreateIndex
CREATE INDEX "Payment_leaseId_date_idx" ON "Payment"("leaseId", "date");
