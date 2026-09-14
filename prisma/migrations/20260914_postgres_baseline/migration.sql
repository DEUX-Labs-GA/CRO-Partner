-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('CONVERSION_RATE', 'REVENUE', 'AVERAGE_ORDER_VALUE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "baselineConversionRate" DOUBLE PRECISION,
    "minimumDetectableEffect" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "significanceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "statisticalPower" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "trackingKey" TEXT,
    "targetProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "titleOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MetricType" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER,
    "clientId" TEXT,
    "pageUrl" TEXT,
    "pagePath" TEXT,
    "pageReferrer" TEXT,
    "pageTitle" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "sku" TEXT,
    "quantity" DOUBLE PRECISION,
    "value" DOUBLE PRECISION,
    "currency" TEXT,
    "checkoutToken" TEXT,
    "orderId" TEXT,
    "experimentId" TEXT,
    "experimentVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Experiment_shop_idx" ON "Experiment"("shop");

-- CreateIndex
CREATE INDEX "Variant_experimentId_idx" ON "Variant"("experimentId");

-- CreateIndex
CREATE INDEX "Metric_experimentId_idx" ON "Metric"("experimentId");

-- CreateIndex
CREATE INDEX "Recommendation_shop_idx" ON "Recommendation"("shop");

-- CreateIndex
CREATE INDEX "BehaviorEvent_shop_eventName_occurredAt_idx" ON "BehaviorEvent"("shop", "eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "BehaviorEvent_shop_clientId_idx" ON "BehaviorEvent"("shop", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviorEvent_shop_eventId_key" ON "BehaviorEvent"("shop", "eventId");

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

