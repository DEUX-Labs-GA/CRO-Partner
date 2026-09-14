-- CreateTable
CREATE TABLE "BehaviorEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "sequence" INTEGER,
    "clientId" TEXT,
    "pageUrl" TEXT,
    "pagePath" TEXT,
    "pageReferrer" TEXT,
    "pageTitle" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "sku" TEXT,
    "quantity" REAL,
    "value" REAL,
    "currency" TEXT,
    "checkoutToken" TEXT,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "BehaviorEvent_shop_eventName_occurredAt_idx" ON "BehaviorEvent"("shop", "eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "BehaviorEvent_shop_clientId_idx" ON "BehaviorEvent"("shop", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviorEvent_shop_eventId_key" ON "BehaviorEvent"("shop", "eventId");
