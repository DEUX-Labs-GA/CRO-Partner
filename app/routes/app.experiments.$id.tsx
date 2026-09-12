import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {
  assessPreAnalysis,
  loadStoreBaseline,
} from "../services/experiment-pre-analysis.server";
import { loadExperimentResults } from "../services/experiment-results.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const experiment = await prisma.experiment.findFirst({
    where: { id: params.id, shop: session.shop },
    include: {
      variants: { orderBy: { createdAt: "asc" } },
      metrics: { where: { isPrimary: true }, take: 1 },
    },
  });

  if (!experiment) {
    throw new Response("Experiment not found", { status: 404 });
  }

  const baseline = await loadStoreBaseline(admin);

  const results = experiment.trackingKey
    ? await loadExperimentResults(
        session.shop,
        experiment.trackingKey,
      )
    : null;

  return {
    experiment,
    results,
    preAnalysis: assessPreAnalysis(baseline, {
      baselineConversionRate: experiment.baselineConversionRate,
      minimumDetectableEffect: experiment.minimumDetectableEffect,
      significanceLevel: experiment.significanceLevel,
      statisticalPower: experiment.statisticalPower,
    }),
  };
};

export default function ExperimentDetailPage() {
  const { experiment, preAnalysis, results } =
    useLoaderData<typeof loader>();
  const primaryMetric = experiment.metrics[0];

  return (
    <s-page heading={experiment.name}>
      <s-section heading="Experiment details">
        <s-paragraph>{experiment.hypothesis}</s-paragraph>
        <s-paragraph>Status: {experiment.status}</s-paragraph>
        <s-paragraph>Created: {experiment.createdAt.toLocaleDateString()}</s-paragraph>
        <s-paragraph>
          Primary metric: {primaryMetric?.name ?? "Not defined"}
          {primaryMetric ? ` (${primaryMetric.type})` : ""}
        </s-paragraph>
      </s-section>
      <s-section heading="Variants">
        <s-unordered-list>
          {experiment.variants.map((variant) => (
            <s-list-item key={variant.id}>
              {variant.name} {variant.isControl ? "(Control)" : "(Treatment)"}
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>
      <s-section heading="Experiment results">
        {!results ? (
          <s-paragraph>
            Results tracking has not been connected to this experiment yet.
          </s-paragraph>
        ) : results.totalExposedVisitors === 0 ? (
          <s-paragraph>
            No experiment exposures have been recorded yet.
          </s-paragraph>
        ) : (
          <>
            <s-paragraph>
              Exposed visitors: {results.totalExposedVisitors}
            </s-paragraph>

            {results.variants.map((variant) => (
              <s-section
                key={variant.variantId}
                heading={
                  variant.variantId === "control"
                    ? "Control"
                    : variant.variantId
                }
              >
                <s-paragraph>
                  Visitors: {variant.visitors}
                </s-paragraph>

                <s-paragraph>
                  Added to cart: {variant.addedToCart}
                </s-paragraph>

                <s-paragraph>
                  Checkout started: {variant.checkoutStarted}
                </s-paragraph>

                <s-paragraph>
                  Purchases: {variant.purchases}
                </s-paragraph>

                <s-paragraph>
                  Conversion rate:{" "}
                  {variant.conversionRate === null
                    ? "—"
                    : `${(variant.conversionRate * 100).toFixed(2)}%`}
                </s-paragraph>

                <s-paragraph>
                  Revenue:{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: results.currency ?? "USD",
                  }).format(variant.revenue)}
                </s-paragraph>

                <s-paragraph>
                  Revenue per visitor:{" "}
                  {variant.revenuePerVisitor === null
                    ? "—"
                    : new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: results.currency ?? "USD",
                      }).format(variant.revenuePerVisitor)}
                </s-paragraph>
              </s-section>
            ))}

            {results.excludedAmbiguousVisitors > 0 ? (
              <s-paragraph>
                Excluded ambiguous visitors:{" "}
                {results.excludedAmbiguousVisitors}
              </s-paragraph>
            ) : null}

            <s-paragraph>
              Results currently use visitor-path attribution: commerce
              activity occurring after experiment exposure is attributed
              using the same Shopify client ID.
            </s-paragraph>
          </>
        )}
      </s-section>

      <s-section heading="Pre-analysis">
        <s-paragraph>Data availability: {preAnalysis.dataAvailability}</s-paragraph>
        <s-paragraph>
          Order-volume data: {preAnalysis.orderDataAvailable ? "Available" : "Unavailable"}
        </s-paragraph>
        <s-paragraph>
          Recent order count ({preAnalysis.orderWindow.label}): {preAnalysis.recentOrderCount ?? "Unavailable"}
        </s-paragraph>
        <s-paragraph>
          Observation window: {preAnalysis.orderWindow.days} days
        </s-paragraph>
        <s-paragraph>
          Orders per day: {preAnalysis.ordersPerDay?.toFixed(2) ?? "Unavailable"}
        </s-paragraph>
        <s-paragraph>Product count: {preAnalysis.productCount}</s-paragraph>
        <s-paragraph>
          Baseline conversion rate (merchant-provided): {preAnalysis.estimate ? `${(preAnalysis.estimate.baselineConversionRate * 100).toFixed(2)}%` : experiment.baselineConversionRate ? `${(experiment.baselineConversionRate * 100).toFixed(2)}%` : "Missing"}
        </s-paragraph>
        <s-paragraph>MDE: {(experiment.minimumDetectableEffect * 100).toFixed(0)}% relative improvement</s-paragraph>
        {preAnalysis.estimate ? (
          <>
            <s-paragraph>Target conversion rate: {(preAnalysis.estimate.targetConversionRate * 100).toFixed(2)}%</s-paragraph>
            <s-paragraph>Estimated sessions per day: {Math.round(preAnalysis.estimate.estimatedSessionsPerDay).toLocaleString()}</s-paragraph>
            <s-paragraph>Estimated sessions per day is inferred from recent orders and the merchant-provided baseline conversion rate.</s-paragraph>
            <s-paragraph>Required sample per variant: {preAnalysis.estimate.requiredSamplePerVariant.toLocaleString()}</s-paragraph>
            <s-paragraph>Total required sample: {preAnalysis.estimate.totalRequiredSample.toLocaleString()}</s-paragraph>
            <s-paragraph>Estimated duration: {preAnalysis.estimate.estimatedDurationDays} days</s-paragraph>
          </>
        ) : null}
        <s-paragraph>Readiness: {preAnalysis.readiness}</s-paragraph>
        <s-paragraph>{preAnalysis.explanation}</s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};