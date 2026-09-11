import prisma from "../db.server";

export const PRODUCT_FUNNEL_WINDOW_DAYS = 30;

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

export async function loadProductFunnel(shop: string) {
  const windowStart = new Date();

  windowStart.setUTCDate(
    windowStart.getUTCDate() - PRODUCT_FUNNEL_WINDOW_DAYS,
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
        gte: windowStart,
      },
    },
    select: {
      eventName: true,
      clientId: true,
      value: true,
      currency: true,
      occurredAt: true,
    },
    orderBy: {
      occurredAt: "asc",
    },
  });

  return summarizeProductFunnel(events, windowStart);
}

export function summarizeProductFunnel(
  events: FunnelEvent[],
  windowStart: Date,
) {
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
     * A visitor enters the funnel only with a product view.
     * Later stages count only when the same visitor reached the
     * immediately preceding stage earlier in the reporting window.
     */
    if (eventStage === 0) {
      visitorsByStage.get("product_viewed")?.add(event.clientId);

      if (currentStage < 0) {
        progressByClient.set(event.clientId, 0);
      }

      continue;
    }

    if (currentStage < eventStage - 1) {
      continue;
    }

    visitorsByStage.get(event.eventName)?.add(event.clientId);

    if (currentStage < eventStage) {
      progressByClient.set(event.clientId, eventStage);
    }

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
    windowDays: PRODUCT_FUNNEL_WINDOW_DAYS,
    windowStart: windowStart.toISOString(),
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
