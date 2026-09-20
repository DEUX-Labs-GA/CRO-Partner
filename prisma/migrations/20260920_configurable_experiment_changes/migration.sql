CREATE TYPE "ExperimentTarget" AS ENUM (
  'PRODUCT_TITLE',
  'ADD_TO_CART_BUTTON'
);

CREATE TYPE "ExperimentChangeType" AS ENUM (
  'REPLACE_TEXT'
);

ALTER TABLE "Variant"
ADD COLUMN "target" "ExperimentTarget",
ADD COLUMN "changeType" "ExperimentChangeType",
ADD COLUMN "changeValue" TEXT;
