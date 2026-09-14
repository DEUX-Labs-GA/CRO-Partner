ALTER TABLE "Experiment" ADD COLUMN "baselineConversionRate" REAL;
ALTER TABLE "Experiment" ADD COLUMN "minimumDetectableEffect" REAL NOT NULL DEFAULT 0.2;
ALTER TABLE "Experiment" ADD COLUMN "significanceLevel" REAL NOT NULL DEFAULT 0.95;
ALTER TABLE "Experiment" ADD COLUMN "statisticalPower" REAL NOT NULL DEFAULT 0.8;