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

  const totalPurchases =
    results?.variants.reduce(
      (total, variant) => total + variant.purchases,
      0,
    ) ?? 0;

  const totalRevenue =
    results?.variants.reduce(
      (total, variant) => total + variant.revenue,
      0,
    ) ?? 0;

  const overallConversionRate =
    results && results.totalExposedVisitors > 0
      ? totalPurchases / results.totalExposedVisitors
      : null;

  const controlResult =
    results?.variants.find(
      (variant) => variant.variantId === "control",
    ) ?? null;

  const treatmentResult =
    results?.variants.find(
      (variant) => variant.variantId !== "control",
    ) ?? null;

  const conversionLift =
    controlResult?.conversionRate &&
    treatmentResult?.conversionRate !== null &&
    treatmentResult?.conversionRate !== undefined
      ? (
          (treatmentResult.conversionRate -
            controlResult.conversionRate) /
          controlResult.conversionRate
        )
      : null;

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
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <MetricCard
                label="Exposed visitors"
                value={results.totalExposedVisitors.toLocaleString()}
              />

              <MetricCard
                label="Purchases"
                value={totalPurchases.toLocaleString()}
              />

              <MetricCard
                label="Conversion rate"
                value={formatPercent(overallConversionRate)}
              />

              <MetricCard
                label="Attributed revenue"
                value={formatCurrency(
                  totalRevenue,
                  results.currency,
                )}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              {results.variants.map((variant) => (
                <div
                  key={variant.variantId}
                  style={{
                    border: "1px solid #dcdcdc",
                    borderRadius: "12px",
                    padding: "18px",
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 650,
                        }}
                      >
                        {variant.variantId === "control"
                          ? "Control"
                          : "Treatment"}
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: "#616161",
                          marginTop: "2px",
                        }}
                      >
                        {variant.variantId}
                      </div>
                    </div>

                    <div
                      style={{
                        borderRadius: "999px",
                        padding: "4px 9px",
                        background:
                          variant.variantId === "control"
                            ? "#f1f1f1"
                            : "#eaf5ff",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {variant.visitors} visitor
                      {variant.visitors === 1 ? "" : "s"}
                    </div>
                  </div>

                  <ResultRow
                    label="Added to cart"
                    value={variant.addedToCart.toLocaleString()}
                  />

                  <ResultRow
                    label="Checkout started"
                    value={variant.checkoutStarted.toLocaleString()}
                  />

                  <ResultRow
                    label="Purchases"
                    value={variant.purchases.toLocaleString()}
                  />

                  <ResultRow
                    label="Conversion rate"
                    value={formatPercent(
                      variant.conversionRate,
                    )}
                    emphasize
                  />

                  <ResultRow
                    label="Revenue"
                    value={formatCurrency(
                      variant.revenue,
                      results.currency,
                    )}
                    emphasize
                  />

                  <ResultRow
                    label="Revenue / visitor"
                    value={
                      variant.revenuePerVisitor === null
                        ? "—"
                        : formatCurrency(
                            variant.revenuePerVisitor,
                            results.currency,
                          )
                    }
                    emphasize
                  />
                </div>
              ))}
            </div>

            {controlResult && treatmentResult ? (
              <div
                style={{
                  border: "1px solid #b7d7c5",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#f2faf5",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    fontWeight: 650,
                    marginBottom: "6px",
                  }}
                >
                  Treatment lift
                </div>

                <div>
                  Conversion-rate lift:{" "}
                  <strong>
                    {conversionLift === null
                      ? "Not available yet"
                      : formatSignedPercent(conversionLift)}
                  </strong>
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid #dcdcdc",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  background: "#f7f7f7",
                  marginBottom: "16px",
                  color: "#4a4a4a",
                }}
              >
                Lift will appear once both control and treatment
                have recorded exposures.
              </div>
            )}

            {results.excludedAmbiguousVisitors > 0 ? (
              <div
                style={{
                  marginBottom: "12px",
                  fontSize: "13px",
                }}
              >
                Excluded ambiguous visitors:{" "}
                {results.excludedAmbiguousVisitors}
              </div>
            ) : null}

            <div
              style={{
                borderTop: "1px solid #ebebeb",
                paddingTop: "12px",
                fontSize: "12px",
                lineHeight: 1.5,
                color: "#616161",
              }}
            >
              Attribution note: commerce activity occurring after
              experiment exposure is currently attributed using the
              same Shopify client ID. This is visitor-path
              attribution.
            </div>
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

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #dcdcdc",
        borderRadius: "12px",
        padding: "16px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#616161",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "24px",
          lineHeight: 1.2,
          fontWeight: 650,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "16px",
        padding: "9px 0",
        borderTop: "1px solid #eeeeee",
      }}
    >
      <span
        style={{
          color: "#616161",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontWeight: emphasize ? 650 : 500,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatCurrency(
  value: number,
  currency: string | null,
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
  }).format(value);
}

function formatPercent(value: number | null) {
  return value === null
    ? "—"
    : `${(value * 100).toFixed(2)}%`;
}

function formatSignedPercent(value: number) {
  const formatted = `${Math.abs(value * 100).toFixed(2)}%`;

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return "0.00%";
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};