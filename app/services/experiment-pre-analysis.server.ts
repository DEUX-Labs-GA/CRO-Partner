import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export const RECENT_ORDER_WINDOW_DAYS = 30;

export const PRE_ANALYSIS_THRESHOLDS = {
  minimumOrdersForAssessment: 1,
  minimumOrdersForEstimation: 100,
} as const;

export type StoreBaseline = {
  shopName: string;
  currency: string;
  productCount: number;
  recentOrderCount: number | null;
  orderDataAvailable: boolean;
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
    orderWindow,
  };
}

export function assessPreAnalysis(baseline: StoreBaseline): PreAnalysis {
  if (baseline.recentOrderCount === null) {
    return {
      ...baseline,
      dataAvailability: "ORDERS_UNAVAILABLE",
      readiness: "INSUFFICIENT_DATA",
      explanation:
        "Not enough data to assess: order-volume data is unavailable with the current Shopify app permissions.",
    };
  }

  if (
    baseline.recentOrderCount < PRE_ANALYSIS_THRESHOLDS.minimumOrdersForAssessment
  ) {
    return {
      ...baseline,
      dataAvailability: "AVAILABLE",
      readiness: "INSUFFICIENT_DATA",
      explanation:
        "Not enough data to assess: the store does not have enough recorded orders yet.",
    };
  }

  if (
    baseline.recentOrderCount < PRE_ANALYSIS_THRESHOLDS.minimumOrdersForEstimation
  ) {
    return {
      ...baseline,
      dataAvailability: "AVAILABLE",
      readiness: "LOW_VOLUME",
      explanation:
        "Available data suggests traffic is too low for a reliable experiment estimate.",
    };
  }

  return {
    ...baseline,
    dataAvailability: "AVAILABLE",
    readiness: "READY_FOR_ESTIMATION",
    explanation:
      "Current order volume is sufficient to begin estimation planning; this is not a significance calculation.",
  };
}