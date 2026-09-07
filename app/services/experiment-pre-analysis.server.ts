import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export const RECENT_ORDER_WINDOW_DAYS = 30;
export const MAX_RECOMMENDED_DURATION_DAYS = 42;

export const DEFAULT_FEASIBILITY_ASSUMPTIONS = {
  minimumDetectableEffect: 0.2,
  significanceLevel: 0.95,
  statisticalPower: 0.8,
} as const;

export type StoreBaseline = {
  shopName: string;
  currency: string;
  productCount: number;
  recentOrderCount: number | null;
  orderDataAvailable: boolean;
  ordersPerDay: number | null;
  orderWindow: {
    days: number;
    startDate: string;
    label: string;
  };
};

export type Readiness =
  | "INSUFFICIENT_DATA"
  | "LOW_VOLUME"
  | "READY_FOR_ESTIMATION";

export type PreAnalysis = StoreBaseline & {
  dataAvailability: "AVAILABLE" | "ORDERS_UNAVAILABLE";
  readiness: Readiness;
  explanation: string;
  estimate: FeasibilityEstimate | null;
};

export type FeasibilityAssumptions = {
  baselineConversionRate: number | null;
  minimumDetectableEffect: number;
  significanceLevel: number;
  statisticalPower: number;
};

export type FeasibilityEstimate = {
  baselineConversionRate: number;
  targetConversionRate: number;
  estimatedSessionsPerDay: number;
  requiredSamplePerVariant: number;
  totalRequiredSample: number;
  estimatedDurationDays: number;
};

type GraphQLResponse<T> = { data?: T };
type BaselineResponse = {
  shop: { name: string; currencyCode: string };
  productsCount: { count: number };
};
type OrdersResponse = { ordersCount: { count: number } };

function getOrderWindow() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - RECENT_ORDER_WINDOW_DAYS);

  return {
    days: RECENT_ORDER_WINDOW_DAYS,
    startDate: start.toISOString().slice(0, 10),
    label: `Last ${RECENT_ORDER_WINDOW_DAYS} days`,
  };
}

export async function loadStoreBaseline(
  admin: AdminApiContext,
): Promise<StoreBaseline> {
  const orderWindow = getOrderWindow();
  const baselineResponse = await admin.graphql(
    `#graphql
      query ExperimentStoreBaseline {
        shop {
          name
          currencyCode
        }
        productsCount { count }
      }`,
  );
  const baseline = (await baselineResponse.json()) as GraphQLResponse<BaselineResponse>;

  if (!baseline.data) {
    throw new Error("Unable to load Shopify product baseline data.");
  }

  let recentOrderCount: number | null = null;
  try {
    const ordersResponse = await admin.graphql(
      `#graphql
        query ExperimentOrderBaseline($query: String) {
          ordersCount(query: $query) { count }
        }`,
      { variables: { query: `created_at:>=${orderWindow.startDate}` } },
    );
    const orders = (await ordersResponse.json()) as GraphQLResponse<OrdersResponse>;
    recentOrderCount = orders.data?.ordersCount.count ?? null;
  } catch {
    // Order data remains unavailable until read_orders is authorized.
  }

  return {
    shopName: baseline.data.shop.name,
    currency: baseline.data.shop.currencyCode,
    productCount: baseline.data.productsCount.count,
    recentOrderCount,
    orderDataAvailable: recentOrderCount !== null,
    ordersPerDay:
      recentOrderCount === null ? null : recentOrderCount / orderWindow.days,
    orderWindow,
  };
}

function inverseNormalCdf(probability: number): number {
  const coefficients = [
    -39.6968302866538, 220.946098424521, -275.928510446969,
    138.357751867269, -30.6647980661472, 2.50662827745924,
  ];
  const denominator = [
    -54.4760987982241, 161.585836858041, -155.698979859887,
    66.8013118877197, -13.2806815528857, 1,
  ];
  const tailNumerator = [
    -0.00778489400243029, -0.322396458041136, -2.40075827716184,
    -2.54973253934373, 4.37466414146497, 2.93816398269878,
  ];
  const tailDenominator = [
    0.00778469570904146, 0.32246712907004, 2.445134137143,
    3.75440866190742,
  ];

  if (probability <= 0 || probability >= 1) return Number.NaN;
  if (probability < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((tailNumerator[0] * q + tailNumerator[1]) * q + tailNumerator[2]) * q + tailNumerator[3]) * q + tailNumerator[4]) * q + tailNumerator[5]) /
      ((((tailDenominator[0] * q + tailDenominator[1]) * q + tailDenominator[2]) * q + tailDenominator[3]) * q + 1);
  }
  if (probability > 0.97575) return -inverseNormalCdf(1 - probability);

  const q = probability - 0.5;
  const r = q * q;
  return (((((coefficients[0] * r + coefficients[1]) * r + coefficients[2]) * r + coefficients[3]) * r + coefficients[4]) * r + coefficients[5]) * q /
    (((((denominator[0] * r + denominator[1]) * r + denominator[2]) * r + denominator[3]) * r + denominator[4]) * r + denominator[5]);
}

export function calculateFeasibility(
  baseline: Pick<StoreBaseline, "recentOrderCount" | "orderWindow">,
  assumptions: FeasibilityAssumptions,
): FeasibilityEstimate | null {
  const { baselineConversionRate, minimumDetectableEffect, significanceLevel, statisticalPower } = assumptions;
  const ordersPerDay = baseline.recentOrderCount === null
    ? 0
    : baseline.recentOrderCount / baseline.orderWindow.days;
  const targetConversionRate = baselineConversionRate === null
    ? Number.NaN
    : baselineConversionRate * (1 + minimumDetectableEffect);

  if (
    !Number.isFinite(baselineConversionRate) ||
    !baselineConversionRate || baselineConversionRate <= 0 || baselineConversionRate >= 1 ||
    !Number.isFinite(minimumDetectableEffect) || minimumDetectableEffect <= 0 ||
    !Number.isFinite(significanceLevel) || significanceLevel <= 0 || significanceLevel >= 1 ||
    !Number.isFinite(statisticalPower) || statisticalPower <= 0 || statisticalPower >= 1 ||
    targetConversionRate >= 1 || ordersPerDay <= 0
  ) return null;

  const alphaZ = inverseNormalCdf(1 - (1 - significanceLevel) / 2);
  const powerZ = inverseNormalCdf(statisticalPower);
  const pooledRate = (baselineConversionRate + targetConversionRate) / 2;
  const difference = targetConversionRate - baselineConversionRate;
  const samplePerVariant = Math.ceil(
    ((alphaZ * Math.sqrt(2 * pooledRate * (1 - pooledRate)) +
      powerZ * Math.sqrt(
        baselineConversionRate * (1 - baselineConversionRate) +
        targetConversionRate * (1 - targetConversionRate),
      )) ** 2) / difference ** 2,
  );
const totalRequiredSample = samplePerVariant * 2;
const estimatedSessionsPerDay = ordersPerDay / baselineConversionRate;

return {
  baselineConversionRate,
  targetConversionRate,
  estimatedSessionsPerDay,
  requiredSamplePerVariant: samplePerVariant,
  totalRequiredSample,
  estimatedDurationDays: Math.ceil(
    totalRequiredSample / estimatedSessionsPerDay,
  ),
};
}

export function assessPreAnalysis(
  baseline: StoreBaseline,
  assumptions: FeasibilityAssumptions,
): PreAnalysis {
  const estimate = calculateFeasibility(baseline, assumptions);
  if (baseline.recentOrderCount === null || baseline.recentOrderCount <= 0 || !estimate) {
    return {
      ...baseline,
      dataAvailability: baseline.recentOrderCount === null ? "ORDERS_UNAVAILABLE" : "AVAILABLE",
      readiness: "INSUFFICIENT_DATA",
      estimate: null,
      explanation: baseline.recentOrderCount === null
        ? "Not enough data to assess: order-volume data is unavailable with the current Shopify app permissions."
        : "Not enough data to assess: enter a valid merchant-provided baseline conversion rate and usable order volume.",
    };
  }

  if (estimate.estimatedDurationDays > MAX_RECOMMENDED_DURATION_DAYS) {
    return {
      ...baseline,
      dataAvailability: "AVAILABLE",
      readiness: "LOW_VOLUME",
      estimate,
      explanation: `This experiment would require approximately ${estimate.requiredSamplePerVariant.toLocaleString()} sessions per variant and is estimated to run for ${estimate.estimatedDurationDays} days based on approximately ${Math.round(estimate.estimatedSessionsPerDay).toLocaleString()} estimated sessions per day. That exceeds the recommended ${MAX_RECOMMENDED_DURATION_DAYS}-day testing window. Consider increasing traffic, testing a larger change, or using another validation method.`,
    };
  }

  return {
    ...baseline,
    dataAvailability: "AVAILABLE",
    readiness: "READY_FOR_ESTIMATION",
    estimate,
    explanation: `This experiment would require approximately ${estimate.requiredSamplePerVariant.toLocaleString()} sessions per variant and is estimated to run for ${estimate.estimatedDurationDays} days based on approximately ${Math.round(estimate.estimatedSessionsPerDay).toLocaleString()} estimated sessions per day, within the recommended ${MAX_RECOMMENDED_DURATION_DAYS}-day testing window.`,
  };
}