import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export const PRE_ANALYSIS_THRESHOLDS = {
  minimumOrdersForAssessment: 1,
  minimumOrdersForEstimation: 100,
} as const;

export type StoreBaseline = {
  productCount: number;
  orderCount: number | null;
};

export type Readiness =
  | "INSUFFICIENT_DATA"
  | "LOW_VOLUME"
  | "READY_FOR_ESTIMATION";

export type PreAnalysis = StoreBaseline & {
  orderDataAvailable: boolean;
  dataAvailability: "AVAILABLE" | "ORDERS_UNAVAILABLE";
  readiness: Readiness;
  explanation: string;
};

type GraphQLResponse<T> = { data?: T };
type BaselineResponse = { productsCount: { count: number } };
type OrdersResponse = { ordersCount: { count: number } };

export async function loadStoreBaseline(
  admin: AdminApiContext,
): Promise<StoreBaseline> {
  const baselineResponse = await admin.graphql(
    `#graphql
      query ExperimentStoreBaseline {
        productsCount { count }
      }`,
  );
  const baseline = (await baselineResponse.json()) as GraphQLResponse<BaselineResponse>;

  if (!baseline.data) {
    throw new Error("Unable to load Shopify product baseline data.");
  }

  let orderCount: number | null = null;
  try {
    const ordersResponse = await admin.graphql(
      `#graphql
        query ExperimentOrderBaseline {
          ordersCount { count }
        }`,
    );
    const orders = (await ordersResponse.json()) as GraphQLResponse<OrdersResponse>;
    orderCount = orders.data?.ordersCount.count ?? null;
  } catch {
    // Order data is optional until the app has an order-read scope.
  }

  return { productCount: baseline.data.productsCount.count, orderCount };
}

export function assessPreAnalysis(baseline: StoreBaseline): PreAnalysis {
  if (baseline.orderCount === null) {
    return {
      ...baseline,
      orderDataAvailable: false,
      dataAvailability: "ORDERS_UNAVAILABLE",
      readiness: "INSUFFICIENT_DATA",
      explanation:
        "Not enough data to assess: order-volume data is unavailable with the current Shopify app permissions.",
    };
  }

  if (baseline.orderCount < PRE_ANALYSIS_THRESHOLDS.minimumOrdersForAssessment) {
    return {
      ...baseline,
      orderDataAvailable: true,
      dataAvailability: "AVAILABLE",
      readiness: "INSUFFICIENT_DATA",
      explanation:
        "Not enough data to assess: the store does not have enough recorded orders yet.",
    };
  }

  if (baseline.orderCount < PRE_ANALYSIS_THRESHOLDS.minimumOrdersForEstimation) {
    return {
      ...baseline,
      orderDataAvailable: true,
      dataAvailability: "AVAILABLE",
      readiness: "LOW_VOLUME",
      explanation:
        "Available data suggests traffic is too low for a reliable experiment estimate.",
    };
  }

  return {
    ...baseline,
    orderDataAvailable: true,
    dataAvailability: "AVAILABLE",
    readiness: "READY_FOR_ESTIMATION",
    explanation:
      "Current order volume is sufficient to begin estimation planning; this is not a significance calculation.",
  };
}