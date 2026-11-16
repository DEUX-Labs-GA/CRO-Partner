import prisma from "../db.server";

import {
  PRODUCT_FUNNEL_WINDOW_DAYS,
  type ProductFunnelWindowDays,
} from "./product-funnel";

const FUNNEL_EVENTS = [
  "product_viewed",
  "product_added_to_cart",
  "checkout_started",
  "checkout_completed",
] as const;

type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

type FunnelEvent = {
  eventName: string;
  clientId: string | null;
  productId: string | null;
  value: number | null;
  currency: string | null;
  occurredAt: Date;
};

type FunnelStep = {
  eventName: FunnelEventName;
  label: string;
  visitors: number;
  rateFromPrevious: number | null;
  rateFromProductView: number | null;
  dropOffFromPrevious: number | null;
  dropOffRateFromPrevious: number | null;
};

type FunnelOptions = {
  selectedProductId?: string | null;
  windowDays?: ProductFunnelWindowDays;
};

export async function loadProductFunnel(
  shop: string,
  selectedProductId?: string | null,
  windowDays: ProductFunnelWindowDays = PRODUCT_FUNNEL_WINDOW_DAYS,
) {
  const windowEnd = new Date();

  const windowStart = new Date(windowEnd);
  windowStart.setUTCDate(
    windowStart.getUTCDate() - windowDays,
  );

  const previousWindowStart = new Date(windowStart);
  previousWindowStart.setUTCDate(
    previousWindowStart.getUTCDate() - windowDays,
  );

  const events = await prisma.behaviorEvent.findMany({
    where: {
      shop,
      eventName: {
        in: [...FUNNEL_EVENTS],
      },
      clientId: {
        not: null,
      },
      occurredAt: {
        gte: previousWindowStart,
        lt: windowEnd,
      },
    },
    select: {
      eventName: true,
      clientId: true,
      productId: true,
      value: true,
      currency: true,
      occurredAt: true,
    },
    orderBy: {
      occurredAt: "asc",
    },
  });

  const currentEvents = events.filter(
    (event) =>
      event.occurredAt >= windowStart &&
      event.occurredAt < windowEnd,
  );

  const previousEvents = events.filter(
    (event) =>
      event.occurredAt >= previousWindowStart &&
      event.occurredAt < windowStart,
  );

  const currentPeriod = summarizeProductFunnel(
    currentEvents,
    windowStart,
    {
      selectedProductId,
      windowDays,
    },
  );

  const previousPeriod = summarizeProductFunnel(
    previousEvents,
    previousWindowStart,
    {
      selectedProductId,
      windowDays,
    },
  );

  return {
    ...currentPeriod,
    previousPeriod,
    comparison: compareProductFunnels(
      currentPeriod,
      previousPeriod,
    ),
  };
}

export function compareProductFunnels(
  current: ReturnType<typeof summarizeProductFunnel>,
  previous: ReturnType<typeof summarizeProductFunnel>,
) {
  return {
    trackedVisitors: createMetricComparison(
      current.trackedVisitors,
      previous.trackedVisitors,
    ),
    purchases: createMetricComparison(
      current.purchases,
      previous.purchases,
    ),
    totalRevenue: createMetricComparison(
      current.totalRevenue,
      previous.totalRevenue,
    ),
    overallConversionRate: createMetricComparison(
      current.overallConversionRate,
      previous.overallConversionRate,
    ),
    steps: current.steps.map((step, index) => {
      const previousStep = previous.steps[index];

      return {
        eventName: step.eventName,
        visitors: createMetricComparison(
          step.visitors,
          previousStep.visitors,
        ),
        rateFromPrevious: createMetricComparison(
          step.rateFromPrevious,
          previousStep.rateFromPrevious,
        ),
        dropOffFromPrevious: createMetricComparison(
          step.dropOffFromPrevious,
          previousStep.dropOffFromPrevious,
        ),
        dropOffRateFromPrevious: createMetricComparison(
          step.dropOffRateFromPrevious,
          previousStep.dropOffRateFromPrevious,
        ),
      };
    }),
  };
}

function createMetricComparison(
  current: number | null,
  previous: number | null,
) {
  if (current === null || previous === null) {
    return {
      current,
      previous,
      absoluteChange: null,
      relativeChange: null,
    };
  }

  const absoluteChange = current - previous;

  return {
    current,
    previous,
    absoluteChange,
    relativeChange:
      previous === 0
        ? current === 0
          ? 0
          : null
        : absoluteChange / previous,
  };
}

export function summarizeProductFunnel(
  events: FunnelEvent[],
  windowStart: Date,
  options: FunnelOptions = {},
) {
  const selectedProductId = options.selectedProductId ?? null;

  const visitorsByStage = new Map<FunnelEventName, Set<string>>();

  for (const eventName of FUNNEL_EVENTS) {
    visitorsByStage.set(eventName, new Set());
  }

  const progressByClient = new Map<string, number>();

  let revenue = 0;
  let currency: string | null = null;

  const sortedEvents = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  for (const event of sortedEvents) {
    if (!event.clientId || !isFunnelEvent(event.eventName)) {
      continue;
    }

    const eventStage = FUNNEL_EVENTS.indexOf(event.eventName);
    const currentStage = progressByClient.get(event.clientId) ?? -1;

    /*
     * A visitor enters the funnel with a tracked PDP view.
     * When a product is selected, that PDP view must belong
     * to the selected product.
     */
    if (eventStage === 0) {
      if (
        selectedProductId &&
        event.productId !== selectedProductId
      ) {
        continue;
      }

      visitorsByStage.get("product_viewed")?.add(event.clientId);

      if (currentStage < 0) {
        progressByClient.set(event.clientId, 0);
      }

      continue;
    }

    /*
     * Product-specific add-to-cart attribution is exact because
     * the cart event carries a product ID.
     */
    if (
      selectedProductId &&
      event.eventName === "product_added_to_cart" &&
      event.productId !== selectedProductId
    ) {
      continue;
    }

    /*
     * Later stages count only when this visitor already reached
     * the immediately preceding funnel stage.
     */
    if (currentStage < eventStage - 1) {
      continue;
    }

    visitorsByStage.get(event.eventName)?.add(event.clientId);

    if (currentStage < eventStage) {
      progressByClient.set(event.clientId, eventStage);
    }

    /*
     * Checkout-completed events currently do not contain
     * line-item product IDs in CRO Partner's normalized payload.
     * Product-level revenue is therefore visitor-path attributed.
     */
    if (event.eventName === "checkout_completed") {
      revenue += event.value ?? 0;
      currency ??= event.currency;
    }
  }

  const counts = {
    productViewed: visitorsByStage.get("product_viewed")?.size ?? 0,
    addedToCart: visitorsByStage.get("product_added_to_cart")?.size ?? 0,
    checkoutStarted: visitorsByStage.get("checkout_started")?.size ?? 0,
    checkoutCompleted: visitorsByStage.get("checkout_completed")?.size ?? 0,
  };

  const steps: FunnelStep[] = [
    createStep(
      "product_viewed",
      "Product viewed",
      counts.productViewed,
      null,
      counts.productViewed,
    ),
    createStep(
      "product_added_to_cart",
      "Added to cart",
      counts.addedToCart,
      counts.productViewed,
      counts.productViewed,
    ),
    createStep(
      "checkout_started",
      "Checkout started",
      counts.checkoutStarted,
      counts.addedToCart,
      counts.productViewed,
    ),
    createStep(
      "checkout_completed",
      "Purchase completed",
      counts.checkoutCompleted,
      counts.checkoutStarted,
      counts.productViewed,
    ),
  ];

  return {
    steps,
    totalRevenue: revenue,
    currency,
    trackedVisitors: counts.productViewed,
    purchases: counts.checkoutCompleted,
    overallConversionRate: rate(
      counts.checkoutCompleted,
      counts.productViewed,
    ),
    windowDays:
      options.windowDays ?? PRODUCT_FUNNEL_WINDOW_DAYS,
    windowStart: windowStart.toISOString(),
    selectedProductId,
    attributionMode: selectedProductId
      ? ("visitor_path" as const)
      : ("store_wide" as const),
  };
}

function createStep(
  eventName: FunnelEventName,
  label: string,
  visitors: number,
  previousVisitors: number | null,
  productViewVisitors: number,
): FunnelStep {
  const dropOff =
    previousVisitors === null
      ? null
      : Math.max(previousVisitors - visitors, 0);

  return {
    eventName,
    label,
    visitors,
    rateFromPrevious:
      previousVisitors === null
        ? null
        : rate(visitors, previousVisitors),
    rateFromProductView:
      eventName === "product_viewed"
        ? productViewVisitors > 0
          ? 1
          : null
        : rate(visitors, productViewVisitors),
    dropOffFromPrevious: dropOff,
    dropOffRateFromPrevious:
      dropOff === null || previousVisitors === null
        ? null
        : rate(dropOff, previousVisitors),
  };
}

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function isFunnelEvent(value: string): value is FunnelEventName {
  return FUNNEL_EVENTS.includes(value as FunnelEventName);
}
