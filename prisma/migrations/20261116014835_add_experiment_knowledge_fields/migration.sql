-- CreateEnum
CREATE TYPE "ExperimentResultOutcome" AS ENUM ('INSUFFICIENT_DATA', 'INCONCLUSIVE', 'TREATMENT_LEADING', 'CONTROL_LEADING', 'NO_DIFFERENCE');

-- CreateEnum
CREATE TYPE "ExperimentRecommendationAction" AS ENUM ('DEPLOY', 'STOP', 'ITERATE', 'RETEST', 'INVESTIGATE', 'SEGMENT', 'GATHER_MORE_DATA');

-- CreateEnum
CREATE TYPE "ExperimentDecision" AS ENUM ('DEPLOY_TREATMENT', 'KEEP_CONTROL', 'ITERATE', 'RETEST', 'CONTINUE_TEST', 'NO_ACTION', 'OTHER');

-- AlterTable
ALTER TABLE "Experiment" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "decision" "ExperimentDecision",
ADD COLUMN     "followUp" TEXT,
ADD COLUMN     "interpretation" TEXT,
ADD COLUMN     "learning" TEXT,
ADD COLUMN     "recommendationAction" "ExperimentRecommendationAction",
ADD COLUMN     "recommendationRationale" TEXT,
ADD COLUMN     "recommendationTitle" TEXT,
ADD COLUMN     "resultOutcome" "ExperimentResultOutcome",
ADD COLUMN     "resultSummary" TEXT,
ADD COLUMN     "revenueImpact" DOUBLE PRECISION,
ADD COLUMN     "revenueImpactCurrency" TEXT;
