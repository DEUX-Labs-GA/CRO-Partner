CREATE TYPE "OpportunityStatus" AS ENUM (
  'RESEARCH_NEEDED',
  'READY_TO_TEST',
  'TESTING',
  'COMPLETED',
  'NOT_PURSUING'
);

CREATE TYPE "OpportunityConfidence" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TYPE "OpportunityImpact" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

CREATE TABLE "Opportunity" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "sourceRuleId" TEXT NOT NULL,
  "productId" TEXT,
  "title" TEXT NOT NULL,
  "observation" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "hypothesis" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "confidence" "OpportunityConfidence" NOT NULL,
  "potentialImpact" "OpportunityImpact" NOT NULL,
  "reach" INTEGER NOT NULL,
  "impactScore" DOUBLE PRECISION NOT NULL,
  "confidenceScore" DOUBLE PRECISION NOT NULL,
  "effort" DOUBLE PRECISION NOT NULL,
  "priorityScore" DOUBLE PRECISION NOT NULL,
  "status" "OpportunityStatus" NOT NULL DEFAULT 'RESEARCH_NEEDED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Opportunity_shop_idx"
ON "Opportunity"("shop");

CREATE INDEX "Opportunity_shop_status_idx"
ON "Opportunity"("shop", "status");

CREATE INDEX "Opportunity_shop_priorityScore_idx"
ON "Opportunity"("shop", "priorityScore");
