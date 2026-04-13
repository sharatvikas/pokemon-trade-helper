-- CreateTable
CREATE TABLE "WantCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "setName" TEXT,
    "setCode" TEXT,
    "cardNumber" TEXT,
    "tcgPlayerId" TEXT,
    "imageUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "tcgMarketPrice" REAL,
    "tcgLowPrice" REAL,
    "ebayAvgSold" REAL,
    "ebayLastSold" REAL,
    "ebayListingCount" INTEGER,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceSnapshot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WantCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertRule_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "WantCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,
    "priceValue" REAL NOT NULL,
    CONSTRAINT "AlertHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PriceSnapshot_cardId_fetchedAt_idx" ON "PriceSnapshot"("cardId", "fetchedAt");

-- CreateIndex
CREATE INDEX "AlertHistory_ruleId_triggeredAt_idx" ON "AlertHistory"("ruleId", "triggeredAt");
