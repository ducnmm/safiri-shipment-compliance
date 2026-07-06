-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "exporter" TEXT,
    "importer" TEXT,
    "invoiceNumber" TEXT,
    "invoiceValue" REAL,
    "currency" TEXT,
    "goodsDescription" TEXT,
    "hsCode" TEXT,
    "countryOfOrigin" TEXT,
    "grossWeightKg" REAL,
    "netWeightKg" REAL,
    "numberOfPackages" INTEGER,
    "containerNumber" TEXT,
    "billOfLading" TEXT,
    "packagingType" TEXT,
    "ispm15Certified" BOOLEAN,
    "arrivalDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mock_ocr',
    "rawPayload" TEXT NOT NULL,
    "mappedFields" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "ranAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueCount" INTEGER NOT NULL,
    CONSTRAINT "ValidationRun_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "field" TEXT,
    "explanation" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    CONSTRAINT "ValidationIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ValidationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Shipment_reference_idx" ON "Shipment"("reference");

-- CreateIndex
CREATE INDEX "Document_shipmentId_idx" ON "Document"("shipmentId");

-- CreateIndex
CREATE INDEX "ValidationRun_shipmentId_idx" ON "ValidationRun"("shipmentId");

-- CreateIndex
CREATE INDEX "ValidationIssue_runId_idx" ON "ValidationIssue"("runId");

-- CreateIndex
CREATE INDEX "AuditLog_shipmentId_idx" ON "AuditLog"("shipmentId");
