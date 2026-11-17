import { buildCompletionInterpretation } from "./experiment-completion-interpretation";
import type {
  AdminApiContext,
} from "@shopify/shopify-app-react-router/server";

import type {
  Experiment,
  Variant,
} from "@prisma/client";

import {
  assessPreAnalysis,
  loadStoreBaseline,
  calculateRequiredSamplePerVariant,
} from "./experiment-pre-analysis.server";

import { loadExperimentResults } from "./experiment-results.server";

import { loadMeasuredTrafficBaseline } from "./measured-traffic.server";

import { calculateExperimentStatistics } from "./experiment-statistics";

import { recommendExperimentResult } from "./experiment-recommendations";

type ExperimentWithVariants = Experiment & {
  variants: Variant[];
};

export async function buildExperimentCompletionSnapshot({
  admin,
  shop,
  experiment,
}: {
  admin: AdminApiContext;
  shop: string;
  experiment: ExperimentWithVariants;
}) {
  const baseline = await loadStoreBaseline(admin);

  const measuredTraffic =
    await loadMeasuredTrafficBaseline({
      shop,
      targetProductId: experiment.targetProductId,
      days: 30,
    });

  const preAnalysis = assessPreAnalysis(
    baseline,
    {
      baselineConversionRate:
        experiment.baselineConversionRate,
      minimumDetectableEffect:
        experiment.minimumDetectableEffect,
      significanceLevel:
        experiment.significanceLevel,
      statisticalPower:
        experiment.statisticalPower,
    },
    measuredTraffic,
  );

  const resultsByDatabaseId =
    await loadExperimentResults(
      shop,
      experiment.id,
    );

  const results =
    resultsByDatabaseId.totalExposedVisitors > 0 ||
    !experiment.trackingKey
      ? resultsByDatabaseId
      : await loadExperimentResults(
          shop,
          experiment.trackingKey,
        );

  const controlVariantId =
    experiment.variants.find(
      (variant) => variant.isControl,
    )?.id ?? null;

  const treatmentVariantId =
    experiment.variants.find(
      (variant) => !variant.isControl,
    )?.id ?? null;

  const controlResult =
    results.variants.find(
      (variant) =>
        variant.variantId === controlVariantId ||
        variant.variantId === "control",
    ) ?? {
      variantId:
        controlVariantId ?? "control",
      visitors: 0,
      addedToCart: 0,
      checkoutStarted: 0,
      purchases: 0,
      conversionRate: null,
      revenue: 0,
      revenuePerVisitor: null,
    };

  const treatmentResult =
    results.variants.find(
      (variant) =>
        variant.variantId === treatmentVariantId ||
        variant.variantId === "variant-a",
    ) ?? {
      variantId:
        treatmentVariantId ?? "variant-a",
      visitors: 0,
      addedToCart: 0,
      checkoutStarted: 0,
      purchases: 0,
      conversionRate: null,
      revenue: 0,
      revenuePerVisitor: null,
    };

  const statistics =
    calculateExperimentStatistics({
      control: {
        visitors: controlResult.visitors,
        conversions: controlResult.purchases,
      },
      treatment: {
        visitors: treatmentResult.visitors,
        conversions: treatmentResult.purchases,
      },
      confidenceLevel:
        experiment.significanceLevel,
      excludedAmbiguousVisitors:
        results.excludedAmbiguousVisitors ?? 0,
    });

    const requiredSamplePerVariant =
    calculateRequiredSamplePerVariant({
        baselineConversionRate:
        experiment.baselineConversionRate,
        minimumDetectableEffect:
        experiment.minimumDetectableEffect,
        significanceLevel:
        experiment.significanceLevel,
        statisticalPower:
        experiment.statisticalPower,
    });

  const plannedSampleReached = Boolean(
  requiredSamplePerVariant !== null &&
    controlResult.visitors >=
      requiredSamplePerVariant &&
    treatmentResult.visitors >=
      requiredSamplePerVariant,
);

  const experimentFeasible =
    preAnalysis.readiness ===
    "READY_FOR_ESTIMATION"
      ? true
      : preAnalysis.readiness === "LOW_VOLUME"
        ? false
        : null;

  const recommendation =
    recommendExperimentResult({
      statistics,
      plannedSampleReached,
      experimentFeasible,
    });

  return {
    completedAt: new Date(),

    resultOutcome: statistics.outcome,

    resultSummary: buildResultSummary({
      controlVisitors:
        controlResult.visitors,
      controlConversions:
        controlResult.purchases,
      controlRate:
        controlResult.conversionRate,
      treatmentVisitors:
        treatmentResult.visitors,
      treatmentConversions:
        treatmentResult.purchases,
      treatmentRate:
        treatmentResult.conversionRate,
      relativeLift:
        statistics.relativeLift,
      pValue:
        statistics.pValue,
    }),

    interpretation:
      buildCompletionInterpretation(
        statistics.outcome,
        plannedSampleReached,
      ),

    recommendationAction:
      recommendation.action,

    recommendationTitle:
      recommendation.title,

    recommendationRationale:
      recommendation.rationale,
  };
}

function buildResultSummary({
  controlVisitors,
  controlConversions,
  controlRate,
  treatmentVisitors,
  treatmentConversions,
  treatmentRate,
  relativeLift,
  pValue,
}: {
  controlVisitors: number;
  controlConversions: number;
  controlRate: number | null;
  treatmentVisitors: number;
  treatmentConversions: number;
  treatmentRate: number | null;
  relativeLift: number | null;
  pValue: number | null;
}) {
  const control =
    controlRate === null
      ? "n/a"
      : `${(controlRate * 100).toFixed(2)}%`;

  const treatment =
    treatmentRate === null
      ? "n/a"
      : `${(treatmentRate * 100).toFixed(2)}%`;

  const lift =
    relativeLift === null
      ? "n/a"
      : `${(relativeLift * 100).toFixed(2)}%`;

  const p =
    pValue === null
      ? "n/a"
      : pValue.toFixed(4);

  return [
    `Control: ${control} (${controlConversions}/${controlVisitors}).`,
    `Treatment: ${treatment} (${treatmentConversions}/${treatmentVisitors}).`,
    `Relative lift: ${lift}.`,
    `p-value: ${p}.`,
  ].join(" ");
}
