import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useRouteError,
} from "react-router";
import { useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {
  assessPreAnalysis,
  loadStoreBaseline,
  calculateRequiredSamplePerVariant,
} from "../services/experiment-pre-analysis.server";
import { loadExperimentResults } from "../services/experiment-results.server";
import { loadMeasuredTrafficBaseline } from "../services/measured-traffic.server";
import {
  canTransitionExperiment,
  getAllowedExperimentTransitions,
  isExperimentStatus,
} from "../services/experiment-lifecycle";

import { calculateExperimentStatistics } 
  from "../services/experiment-statistics";

import { CROVariantComparisonChart } from "../components/charts/CROVariantComparisonChart"; 

import { CROFeasibilityChart } from "../components/charts/CROFeasibilityChart";

import { CROConfidenceLiftChart } from "../components/charts/CROConfidenceLiftChart";

import { loadExperimentExposureHistory } from "../services/experiment-exposure-history.server";

import { CROExposureHistoryChart } from "../components/charts/CROExposureHistoryChart";

import { CROSampleProgressChart } from "../components/charts/CROSampleProgressChart";

import { CROStatisticalDistributionChart } from "../components/charts/CROStatisticalDistributionChart";

import {
  recommendExperimentResult,
  type ResultRecommendationAction,
} from "../services/experiment-recommendations";

import { buildExperimentCompletionSnapshot } from "../services/experiment-knowledge.server";

export const action = async ({
  request,
  params,
}: ActionFunctionArgs) => {
  const { admin, session } =
  await authenticate.admin(request);
  const formData = await request.formData();

  const nextStatus = formData.get("status");
  const completionConfirmed =
    formData.get("completionConfirmed") === "true";

  if (!isExperimentStatus(nextStatus)) {
    throw new Response("Invalid experiment status", {
      status: 400,
    });
  }

  const experiment = await prisma.experiment.findFirst({
    where: {
      id: params.id,
      shop: session.shop,
    },
    include: {
      variants: true,
    },
  });

  if (!experiment) {
    throw new Response("Experiment not found", {
      status: 404,
    });
  }

  if (
    nextStatus === "COMPLETED" &&
    !completionConfirmed
  ) {
    throw new Response(
      "Experiment completion requires confirmation",
      { status: 400 },
    );
  }

  if (
    !canTransitionExperiment(
      experiment.status,
      nextStatus,
    )
  ) {
    throw new Response(
      `Cannot move experiment from ${experiment.status} to ${nextStatus}`,
      { status: 400 },
    );
  }

  const completionSnapshot =
    nextStatus === "COMPLETED"
      ? await buildExperimentCompletionSnapshot({
          admin,
          shop: session.shop,
          experiment,
        })
      : null;

  const transition = await prisma.experiment.updateMany({
    where: {
      id: experiment.id,
      shop: session.shop,
      status: experiment.status,
      updatedAt: experiment.updatedAt,
    },
    data: {
      status: nextStatus,
      ...(completionSnapshot ?? {}),
    },
  });

  if (transition.count !== 1) {
    throw new Response(
      "Experiment changed while this request was being processed. Reload and try again.",
      { status: 409 },
    );
  }

  return { ok: true };
};

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

  const measuredTraffic =
    await loadMeasuredTrafficBaseline({
      shop: session.shop,
      targetProductId: experiment.targetProductId,
      days: 30,
    });

  const resultsByDatabaseId =
    await loadExperimentResults(
      session.shop,
      experiment.id,
    );

  const results =
    resultsByDatabaseId.totalExposedVisitors > 0 ||
    !experiment.trackingKey
      ? resultsByDatabaseId
      : await loadExperimentResults(
          session.shop,
          experiment.trackingKey,
        );

    const exposureHistoryByDatabaseId =
      await loadExperimentExposureHistory(
        session.shop,
        experiment.id,
      );

    const exposureHistory =
      exposureHistoryByDatabaseId.length > 0 ||
      !experiment.trackingKey
        ? exposureHistoryByDatabaseId
        : await loadExperimentExposureHistory(
            session.shop,
            experiment.trackingKey,
          );        

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

  return {
    experiment,
    results,
    exposureHistory,
    requiredSamplePerVariant,
    preAnalysis: assessPreAnalysis(
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
    ),
  };
};

export default function ExperimentDetailPage() {
const {
  experiment,
  preAnalysis,
  results,
  exposureHistory,
  requiredSamplePerVariant,
} = useLoaderData<typeof loader>();
  const [
  completionConfirmationContext,
  setCompletionConfirmationContext,
  ] = useState<"GENERIC" | "STOP" | "DEPLOY" | null>(
    null,
  );
  const primaryMetric = experiment.metrics[0];
  const allowedTransitions =
    getAllowedExperimentTransitions(experiment.status);

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

  const controlVariantId =
    experiment.variants.find(
      (variant) => variant.isControl,
    )?.id ?? null;

  const treatmentVariantId =
    experiment.variants.find(
      (variant) => !variant.isControl,
    )?.id ?? null;

  const controlResult =
    results?.variants.find(
      (variant) =>
        variant.variantId === controlVariantId ||
        variant.variantId === "control",
    ) ?? null;

  const treatmentResult =
    results?.variants.find(
      (variant) =>
        variant.variantId === treatmentVariantId ||
        variant.variantId === "variant-a",
    ) ?? null;

  const controlVariantName =
    experiment.variants.find(
      (variant) => variant.isControl,
    )?.name ?? "Control";

  const treatmentVariantName =
    experiment.variants.find(
      (variant) => !variant.isControl,
    )?.name ?? "Treatment";

  const exposureHistoryData =
    exposureHistory.map((point) => ({
      date: point.date,

      control:
        (controlVariantId
          ? point.cumulativeByVariant[
              controlVariantId
            ]
          : undefined) ??
        point.cumulativeByVariant.control ??
        0,

      treatment:
        (treatmentVariantId
          ? point.cumulativeByVariant[
              treatmentVariantId
            ]
          : undefined) ??
        point.cumulativeByVariant[
          "variant-a"
        ] ??
        0,
    }));    

  const statistics =
    controlResult && treatmentResult
      ? calculateExperimentStatistics({
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
            results?.excludedAmbiguousVisitors ?? 0,
        })
      : null;

      const plannedSampleReached =
        Boolean(
          requiredSamplePerVariant !== null &&
            controlResult &&
            treatmentResult &&
            controlResult.visitors >=
              requiredSamplePerVariant &&
            treatmentResult.visitors >=
              requiredSamplePerVariant,
        );

const experimentFeasible =
  preAnalysis.readiness === "READY_FOR_ESTIMATION"
    ? true
    : preAnalysis.readiness === "LOW_VOLUME"
      ? false
      : null;

const resultRecommendation =
  statistics
    ? recommendExperimentResult({
        statistics,
        plannedSampleReached,
        experimentFeasible,
      })
    : null;

    const recommendationPresentation =
  resultRecommendation
    ? getRecommendationPresentation(
        resultRecommendation.action,
      )
    : null;

const recommendationStatusAction =
  resultRecommendation
    ? getRecommendationStatusAction({
        action: resultRecommendation.action,
        experimentStatus: experiment.status,
        allowedTransitions,
      })
    : null;

const followUpExperimentHref =
  resultRecommendation?.action === "RETEST" ||
  resultRecommendation?.action === "ITERATE"
    ? `/app/experiments/new?followUpFrom=${encodeURIComponent(
        experiment.id,
      )}&followUpMode=${resultRecommendation.action}`
    : null;    

const variantComparisonData =
  controlResult && treatmentResult
    ? [
        {
          label: controlVariantName,
          conversionRate:
            controlResult.conversionRate ?? 0,
          visitors:
            controlResult.visitors,
          conversions:
            controlResult.purchases,
        },
        {
          label: treatmentVariantName,
          conversionRate:
            treatmentResult.conversionRate ?? 0,
          visitors:
            treatmentResult.visitors,
          conversions:
            treatmentResult.purchases,
        },
      ]
    : [];  
    
    const sampleProgressData =
      controlResult && treatmentResult
        ? [
            {
              label: controlVariantName,
              visitors: controlResult.visitors,
            },
            {
              label: treatmentVariantName,
              visitors: treatmentResult.visitors,
            },
          ]
        : [];    

  return (
    <s-page heading={experiment.name}>
      <s-section heading="Experiment details">
        <s-paragraph>{experiment.hypothesis}</s-paragraph>
        <s-paragraph>Status: {formatStatus(experiment.status)}</s-paragraph>

        {allowedTransitions.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              margin: "12px 0 16px",
            }}
          >
        {allowedTransitions.map((status) =>
          status === "COMPLETED" ? (
            <button
              key={status}
              type="button"
              onClick={() =>
                setCompletionConfirmationContext("GENERIC")
              }
              style={{
                appearance: "none",
                border: "1px solid #8a8a8a",
                borderRadius: "8px",
                background: "#ffffff",
                color: "#202020",
                padding: "8px 12px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {formatStatus(status)}
            </button>
          ) : (
            <Form method="post" key={status}>
              <button
                type="submit"
                name="status"
                value={status}
                style={{
                  appearance: "none",
                  border: "1px solid #8a8a8a",
                  borderRadius: "8px",
                  background: "#ffffff",
                  color: "#202020",
                  padding: "8px 12px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {formatStatus(status)}
              </button>
            </Form>
          ),
        )}
          </div>
        ) : null}

        {completionConfirmationContext ? (
          <div
            style={{
              margin: "12px 0 16px",
              padding: "16px",
              border: "1px solid #c9c9c9",
              borderRadius: "10px",
              background: "#fafafa",
              maxWidth: "720px",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: "6px",
              }}
            >
              Confirm experiment completion
            </div>

            <div
              style={{
                fontSize: "13px",
                lineHeight: 1.5,
                marginBottom: "14px",
              }}
            >
              {completionConfirmationContext === "STOP"
                ? "CRO Partner recommends stopping this experiment. Completing it will end the active experiment lifecycle. The experiment record and results will remain available."
                : completionConfirmationContext === "DEPLOY"
                  ? "CRO Partner recommends moving forward with the treatment. Completing this experiment will end the active experiment lifecycle. The experiment record and results will remain available."
                  : "Completing this experiment will end the active experiment lifecycle. The experiment record and results will remain available."}
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setCompletionConfirmationContext(null)
                }
                style={{
                  appearance: "none",
                  border: "1px solid #8a8a8a",
                  borderRadius: "8px",
                  background: "#ffffff",
                  color: "#202020",
                  padding: "9px 14px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <Form method="post">
                <input
                  type="hidden"
                  name="status"
                  value="COMPLETED"
                />
                <input
                  type="hidden"
                  name="completionConfirmed"
                  value="true"
                />

                <button
                  type="submit"
                  style={{
                    appearance: "none",
                    border: "1px solid #202020",
                    borderRadius: "8px",
                    background: "#202020",
                    color: "#ffffff",
                    padding: "9px 14px",
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Confirm completion
                </button>
              </Form>
            </div>
          </div>
        ) : null}        

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

{exposureHistoryData.length > 0 ? (
  <div
    style={{
      marginBottom: "24px",
    }}
  >
    <div
      style={{
        fontWeight: 650,
        marginBottom: "4px",
      }}
    >
      Exposure history
    </div>

    <div
      style={{
        fontSize: "13px",
        color: "#616161",
        marginBottom: "8px",
      }}
    >
      Cumulative exposed visitors over time for
      control and treatment. A widening gap can
      indicate uneven traffic allocation.
    </div>

    <CROExposureHistoryChart
      data={exposureHistoryData}
      controlLabel={controlVariantName}
      treatmentLabel={treatmentVariantName}
    />
  </div>
) : null}

{sampleProgressData.length === 2 &&
requiredSamplePerVariant !== null ? (
  <div
    style={{
      marginBottom: "24px",
    }}
  >
    <div
      style={{
        fontWeight: 650,
        marginBottom: "4px",
      }}
    >
      Sample progress
    </div>

    <div
      style={{
        fontSize: "13px",
        color: "#616161",
        marginBottom: "8px",
      }}
    >
      Progress toward the planned sample size for
      each variant. Reaching the target does not
      guarantee a winner, but it indicates that the
      experiment has collected the planned amount of
      traffic for analysis.
    </div>

    <CROSampleProgressChart
    data={sampleProgressData}
    requiredSamplePerVariant={
      requiredSamplePerVariant
    }
  />    
  </div>
) : null}

{variantComparisonData.length === 2 ? (
  <div
    style={{
      marginBottom: "24px",
    }}
  >
    <div
      style={{
        fontWeight: 650,
        marginBottom: "4px",
      }}
    >
      Conversion rate comparison
    </div>

    <div
      style={{
        fontSize: "13px",
        color: "#616161",
        marginBottom: "8px",
      }}
    >
      Observed purchase conversion rate for control and treatment.
    </div>

    <CROVariantComparisonChart
      data={variantComparisonData}
    />
  </div>
) : null}   

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
                        {variant.variantId === controlVariantId ||
                        variant.variantId === "control"
                          ? controlVariantName
                          : treatmentVariantName}
                      </div>

                    </div>

                    <div
                      style={{
                        borderRadius: "999px",
                        padding: "4px 9px",
                        background:
                          variant.variantId === controlVariantId ||
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

            {statistics && controlResult && treatmentResult ? (
              <div
                style={{
                  border: "1px solid #dcdcdc",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#f7f7f7",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    fontWeight: 650,
                    marginBottom: "10px",
                  }}
                >
                  Statistical interpretation
                </div>

                <CROConfidenceLiftChart
                  absoluteLift={
                    statistics.absoluteLift
                  }
                  relativeLift={
                    statistics.relativeLift
                  }
                  confidenceInterval={
                    statistics.confidenceInterval
                  }
                  confidenceLevel={
                    statistics.confidenceLevel
                  }
                  outcome={
                    statistics.outcome
                  }
                  hasCriticalValidityIssue={
                    statistics.hasCriticalValidityIssue
                  }
                />   

{resultRecommendation && recommendationPresentation ? (
  <div
    style={{
      marginBottom: "20px",
      border: `1px solid ${recommendationPresentation.border}`,
      borderLeft: `5px solid ${recommendationPresentation.accent}`,
      borderRadius: "12px",
      padding: "18px",
      background: recommendationPresentation.background,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "10px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "11px",
            color: "#616161",
            marginBottom: "5px",
          }}
        >
          CRO Partner recommendation
        </div>

        <div
          style={{
            display: "inline-block",
            border: `1px solid ${recommendationPresentation.accent}`,
            borderRadius: "999px",
            padding: "3px 8px",
            fontSize: "10px",
            fontWeight: 650,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: "10px",
          }}
        >
          {recommendationPresentation.label}
        </div>

        <div
          style={{
            fontSize: "18px",
            fontWeight: 650,
            marginBottom: "8px",
          }}
        >
          {resultRecommendation.title}
        </div>
      </div>
    </div>

    <div
      style={{
        fontSize: "13px",
        lineHeight: 1.55,
        color: "#4a4a4a",
        maxWidth: "960px",
      }}
    >
      {resultRecommendation.rationale}
    </div>

    <div
      style={{
        marginTop: "12px",
        paddingTop: "12px",
        borderTop: "1px solid rgba(0, 0, 0, 0.10)",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          marginBottom: "5px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Next action
      </div>

      <div
        style={{
          fontSize: "13px",
          lineHeight: 1.5,
          marginBottom: recommendationStatusAction
            ? "12px"
            : 0,
        }}
      >
        {recommendationPresentation.nextAction}
      </div>

      {recommendationStatusAction ? (
        recommendationStatusAction.status === "COMPLETED" ? (
          <button
            type="button"
            onClick={() =>
              setCompletionConfirmationContext(
                resultRecommendation?.action === "STOP"
                  ? "STOP"
                  : resultRecommendation?.action === "DEPLOY"
                    ? "DEPLOY"
                    : "GENERIC",
              )
            }
            style={{
              appearance: "none",
              border: "1px solid #202020",
              borderRadius: "8px",
              background: "#202020",
              color: "#ffffff",
              padding: "9px 14px",
              fontSize: "13px",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            {recommendationStatusAction.label}
          </button>
        ) : (
          <Form method="post">
            <button
              type="submit"
              name="status"
              value={recommendationStatusAction.status}
              style={{
                appearance: "none",
                border: "1px solid #202020",
                borderRadius: "8px",
                background: "#202020",
                color: "#ffffff",
                padding: "9px 14px",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              {recommendationStatusAction.label}
            </button>
          </Form>
        )
      ) : null}

      {followUpExperimentHref ? (
        <Link
          to={followUpExperimentHref}
          style={{
            display: "inline-block",
            appearance: "none",
            border: "1px solid #202020",
            borderRadius: "8px",
            background: "#202020",
            color: "#ffffff",
            padding: "9px 14px",
            fontSize: "13px",
            fontWeight: 650,
            lineHeight: 1.2,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          Create follow-up experiment
        </Link>
      ) : null}     
    </div>
  </div>
) : null}           
                
                    <div
                    style={{
                      marginTop: "18px",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 650,
                        marginBottom: "4px",
                      }}
                    >
                      Statistical distribution
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        color: "#616161",
                        marginBottom: "8px",
                        lineHeight: 1.5,
                      }}
                    >
                      Approximate conversion-rate distributions for
                      control and treatment. More overlap means more
                      uncertainty about which experience is actually
                      better.
                    </div>

                    <CROStatisticalDistributionChart
                      controlVisitors={
                        controlResult.visitors
                      }
                      controlConversions={
                        controlResult.purchases
                      }
                      treatmentVisitors={
                        treatmentResult.visitors
                      }
                      treatmentConversions={
                        treatmentResult.purchases
                      }
                      controlLabel={
                        controlVariantName
                      }
                      treatmentLabel={
                        treatmentVariantName
                      }
                    />
                  </div>     

                  <details
                    style={{
                      marginTop: "16px",
                      borderTop: "1px solid #e2e2e2",
                      paddingTop: "14px",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 650,
                        color: "#4a4a4a",
                      }}
                    >
                      Technical details
                    </summary>

                    <div
                      style={{
                        marginTop: "12px",
                      }}
                    >
                      <ResultRow
                        label="Absolute lift"
                        value={formatSignedPercentagePoints(
                          statistics.absoluteLift,
                        )}
                      />

                      <s-paragraph>Data availability: {preAnalysis.dataAvailability}</s-paragraph>
                      <s-paragraph>
                        Traffic source:{" "}
                        {preAnalysis.trafficSource === "MEASURED_PRODUCT_VISITORS"
                          ? "Measured eligible product visitors"
                          : "Estimated from recent orders"}
                      </s-paragraph>

                      {preAnalysis.measuredTraffic ? (
                        <>
                          <s-paragraph>
                            Measured eligible visitors:{" "}
                            {preAnalysis.measuredTraffic.eligibleVisitors.toLocaleString()}
                          </s-paragraph>

                          <s-paragraph>
                            Measurement coverage:{" "}
                            {preAnalysis.measuredTraffic.days} of{" "}
                            {preAnalysis.measuredTraffic.lookbackDays} days
                          </s-paragraph>

                          <s-paragraph>
                            Measured eligible visitors per day:{" "}
                            {preAnalysis.measuredTraffic.eligibleVisitorsPerDay.toFixed(2)}
                          </s-paragraph>
                        </>
                      ) : null}
                      
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
                          <s-paragraph>
                            {preAnalysis.trafficSource === "MEASURED_PRODUCT_VISITORS"
                              ? "Eligible visitors per day"
                              : "Estimated sessions per day"}
                            :{" "}
                            {Math.round(
                              preAnalysis.estimate.estimatedSessionsPerDay,
                            ).toLocaleString()}
                          </s-paragraph>
                          <s-paragraph>
                            {preAnalysis.trafficSource === "MEASURED_PRODUCT_VISITORS"
                              ? "Traffic is measured from CRO Partner product-view events for the experiment’s target product."
                              : "Traffic is inferred from recent orders and the merchant-provided baseline conversion rate."}
                          </s-paragraph>
                          <s-paragraph>Required sample per variant: {preAnalysis.estimate.requiredSamplePerVariant.toLocaleString()}</s-paragraph>
                          <s-paragraph>Total required sample: {preAnalysis.estimate.totalRequiredSample.toLocaleString()}</s-paragraph>
                          <s-paragraph>Estimated duration: {preAnalysis.estimate.estimatedDurationDays} days</s-paragraph>
                        </>
                      ) : null}
                      <s-paragraph>Readiness: {preAnalysis.readiness}</s-paragraph>
                      <s-paragraph>{preAnalysis.explanation}</s-paragraph>               
                    </div>
                  </details>                

                <ResultRow
                  label="Relative lift"
                  value={
                    statistics.relativeLift === null
                      ? "Not available"
                      : formatSignedPercent(
                          statistics.relativeLift,
                        )
                  }
                />

                <ResultRow
                  label={`${Math.round(
                    statistics.confidenceLevel * 100,
                  )}% confidence interval`}
                  value={
                    statistics.confidenceInterval
                      ? `${formatSignedPercentagePoints(
                          statistics.confidenceInterval.lower,
                        )} to ${formatSignedPercentagePoints(
                          statistics.confidenceInterval.upper,
                        )}`
                      : "Not available"
                  }
                />

                <ResultRow
                  label="P-value"
                  value={
                    statistics.pValue === null
                      ? "Not available"
                      : statistics.pValue < 0.001
                        ? "< 0.001"
                        : statistics.pValue.toFixed(3)
                  }
                />

                <ResultRow
                  label="Statistically significant"
                  value={
                    statistics.statisticallySignificant
                      ? "Yes"
                      : "No"
                  }
                />

                <ResultRow
                  label="Directional interpretation"
                  value={
                    statistics.canDeclareDirectionalResult
                      ? "Eligible"
                      : "Not eligible"
                  }
                />                

                <ResultRow
                  label="Outcome"
                  value={formatStatisticalOutcome(
                    statistics.outcome,
                  )}
                  emphasize
                />

                <div
                  style={{
                    marginTop: "10px",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    color: "#4a4a4a",
                  }}
                >
                  {statistics.hasCriticalValidityIssue
                    ? "A critical validity issue prevents a directional conclusion even if the raw statistical test appears significant."
                    : "No critical validity issue is currently blocking directional interpretation."}
                </div>                

                <div
                  style={{
                    marginTop: "12px",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    color: "#4a4a4a",
                  }}
                >
                  {getStatisticalExplanation(
                    statistics.outcome,
                  )}
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "14px",
                    borderTop: "1px solid #e2e2e2",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 650,
                      marginBottom: "8px",
                    }}
                  >
                    Validity checks
                  </div>

                  {statistics.validityChecks.map((check) => (
                    <div
                      key={check.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "120px 1fr",
                        gap: "12px",
                        padding: "7px 0",
                        fontSize: "13px",
                        lineHeight: 1.45,
                      }}
                    >
                      <strong>
                        {formatValidityStatus(check.status)}
                      </strong>

                      <span>{check.message}</span>
                    </div>
                  ))}
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
                Statistical comparison will appear once both
                control and treatment have recorded exposures.
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
        {preAnalysis.estimate ? (
          <div
            style={{
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                fontWeight: 650,
                marginBottom: "4px",
              }}
            >
              Experiment feasibility
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#616161",
                marginBottom: "8px",
              }}
            >
              Traffic capacity compared with the sample required
              for a reliable experiment within the recommended
              42-day testing window.
            </div>

            <CROFeasibilityChart
              requiredSample={
                preAnalysis.estimate
                  .totalRequiredSample
              }
              visitorsPerDay={
                preAnalysis.estimate
                  .estimatedSessionsPerDay
              }
              recommendedDurationDays={42}
              estimatedDurationDays={
                preAnalysis.estimate
                  .estimatedDurationDays
              }
            />
          </div>
        ) : null}

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

function getRecommendationPresentation(
  action: ResultRecommendationAction,
) {
  switch (action) {
    case "DEPLOY":
      return {
        label: "Ready for rollout review",
        nextAction:
          "Review implementation risk and business impact. If the experiment is finished, mark it complete before managing rollout separately.",
        background: "#f3fbf5",
        border: "#b7d9bd",
        accent: "#327a42",
      };

    case "STOP":
      return {
        label: "Do not roll out",
        nextAction:
          "End the experiment and retain control unless there is a documented business reason to continue with the treatment.",
        background: "#fff6f5",
        border: "#e5bbb5",
        accent: "#a33b32",
      };

    case "ITERATE":
      return {
        label: "Next hypothesis",
        nextAction:
          "Use what this experiment taught you to strengthen the hypothesis and design a materially different variation.",
        background: "#f7f7fb",
        border: "#c9c9dc",
        accent: "#58588a",
      };

    case "RETEST":
      return {
        label: "Redesign recommended",
        nextAction:
          "Revise the experiment setup, targeting, traffic scope, or detectable effect before starting another test.",
        background: "#fff9ed",
        border: "#e6cea0",
        accent: "#8a6417",
      };

    case "INVESTIGATE":
      return {
        label: "Validity review required",
        nextAction:
          "Review allocation, exposure quality, implementation, and tracking before using the observed result to make a business decision.",
        background: "#fff8e8",
        border: "#e3c989",
        accent: "#866216",
      };

    case "SEGMENT":
      return {
        label: "Explore segments",
        nextAction:
          "Inspect whether meaningful audience or behavioral segments are masking materially different responses to the treatment.",
        background: "#f2f7fc",
        border: "#b9cee2",
        accent: "#356b93",
      };

    case "GATHER_MORE_DATA":
      return {
        label: "Keep running",
        nextAction:
          "Continue collecting qualified exposures until the planned sample is reached or the experiment becomes operationally impractical.",
        background: "#f2f7fc",
        border: "#b9cee2",
        accent: "#356b93",
      };
  }
}

function getRecommendationStatusAction({
  action,
  experimentStatus,
  allowedTransitions,
}: {
  action: ResultRecommendationAction;
  experimentStatus: string;
  allowedTransitions: string[];
}) {
  /*
   * Recommendation actions never bypass the experiment lifecycle.
   * We only expose transitions that are already legal for the
   * experiment's current state.
   */

  if (
    (action === "DEPLOY" || action === "STOP") &&
    allowedTransitions.includes("COMPLETED")
  ) {
    return {
      status: "COMPLETED",
      label:
        action === "DEPLOY"
          ? "Mark experiment complete"
          : "Complete and stop experiment",
    };
  }

  if (
    action === "GATHER_MORE_DATA" &&
    experimentStatus === "PAUSED" &&
    allowedTransitions.includes("RUNNING")
  ) {
    return {
      status: "RUNNING",
      label: "Resume experiment",
    };
  }

  return null;
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_, prefix, letter) =>
      `${prefix ? " " : ""}${letter.toUpperCase()}`,
    );
}

function getTransitionLabel(
  currentStatus: string,
  nextStatus: string,
) {
  if (currentStatus === "DRAFT" && nextStatus === "READY") {
    return "Mark ready";
  }

  if (currentStatus === "READY" && nextStatus === "RUNNING") {
    return "Start experiment";
  }

  if (currentStatus === "READY" && nextStatus === "DRAFT") {
    return "Return to draft";
  }

  if (currentStatus === "RUNNING" && nextStatus === "PAUSED") {
    return "Pause experiment";
  }

  if (currentStatus === "PAUSED" && nextStatus === "RUNNING") {
    return "Resume experiment";
  }

  if (nextStatus === "COMPLETED") {
    return "Complete experiment";
  }

  if (nextStatus === "ARCHIVED") {
    return "Archive experiment";
  }

  return `Move to ${formatStatus(nextStatus)}`;
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


function formatSignedPercentagePoints(
  value: number | null,
) {
  if (value === null) {
    return "—";
  }

  const percentagePoints = value * 100;

  if (percentagePoints > 0) {
    return `+${percentagePoints.toFixed(2)} pp`;
  }

  if (percentagePoints < 0) {
    return `${percentagePoints.toFixed(2)} pp`;
  }

  return "0.00 pp";
}

function formatStatisticalOutcome(
  outcome:
    | "INSUFFICIENT_DATA"
    | "INCONCLUSIVE"
    | "TREATMENT_LEADING"
    | "CONTROL_LEADING"
    | "NO_DIFFERENCE",
) {
  return outcome
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_, prefix, letter) =>
      `${prefix ? " " : ""}${letter.toUpperCase()}`,
    );
}

function getStatisticalExplanation(
  outcome:
    | "INSUFFICIENT_DATA"
    | "INCONCLUSIVE"
    | "TREATMENT_LEADING"
    | "CONTROL_LEADING"
    | "NO_DIFFERENCE",
) {
  switch (outcome) {
    case "INSUFFICIENT_DATA":
      return "There is not enough traffic in both variants to treat the observed difference as a reliable experiment result.";

    case "INCONCLUSIVE":
      return "The variants have enough directional traffic, but the observed difference is not statistically significant at the configured confidence level.";

    case "TREATMENT_LEADING":
      return "The treatment conversion rate is statistically higher than control at the configured confidence level.";

    case "CONTROL_LEADING":
      return "The control conversion rate is statistically higher than treatment at the configured confidence level.";

    case "NO_DIFFERENCE":
      return "The observed conversion rates are effectively the same in this comparison.";
  }
}

function formatValidityStatus(
  status: "PASS" | "WARNING" | "NOT_APPLICABLE",
) {
  switch (status) {
    case "PASS":
      return "Pass";

    case "WARNING":
      return "Warning";

    case "NOT_APPLICABLE":
      return "Pending";
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export function ErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();

  if (isRouteErrorResponse(error) && error.status === 409) {
    return (
      <s-page heading="Experiment changed">
        <div role="alert">
          <h2>Your status change was not saved</h2>
          <p>
            This experiment changed while your request was being processed.
            Reload the latest experiment, review its status, and try again if
            the change is still needed. Completing it will require confirmation
            again.
          </p>
        </div>
        <Link to={`${location.pathname}${location.search}`} reloadDocument>
          Reload experiment
        </Link>
      </s-page>
    );
  }

  return boundary.error(error);
}
