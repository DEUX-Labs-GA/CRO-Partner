import prisma from "../db.server";

const FUNNEL_EVENTS = [
  "product_viewed",
  "product_added_to_cart",
  "checkout_started",
  "checkout_completed",
] as const;

type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

type FunnelStep = {
  eventName: FunnelEventName;
  label: string;
  visitors: number;
  rateFromPrevious: number | null;
  rateFromProductView: number | null;
};

export async function loadProductFunnel(shop: string) {
  const events = await prisma.behaviorEvent.findMany({
    where: {
      shop,
      eventName: {
        in: [...FUNNEL_EVENTS],
      },
      clientId: {
        not: null,
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

  const visitorSets = new Map<FunnelEventName, Set<string>>();

  for (const eventName of FUNNEL_EVENTS) {
    visitorSets.set(eventName, new Set());
  }

  let revenue = 0;
  let currency: string | null = null;

  for (const event of events) {
    if (!isFunnelEvent(event.eventName) || !event.clientId) {
      continue;
    }

    visitorSets.get(event.eventName)?.add(event.clientId);

    if (event.eventName === "checkout_completed") {
      revenue += event.value ?? 0;
      currency ??= event.currency;
    }
  }

  const counts = {
    productViewed: visitorSets.get("product_viewed")?.size ?? 0,
    addedToCart: visitorSets.get("product_added_to_cart")?.size ?? 0,
    checkoutStarted: visitorSets.get("checkout_started")?.size ?? 0,
    checkoutCompleted: visitorSets.get("checkout_completed")?.size ?? 0,
  };

  const steps: FunnelStep[] = [
    {
      eventName: "product_viewed",
      label: "Product viewed",
      visitors: counts.productViewed,
      rateFromPrevious: null,
      rateFromProductView:
        counts.productViewed > 0 ? 1 : null,
    },
    {
      eventName: "product_added_to_cart",
      label: "Added to cart",
      visitors: counts.addedToCart,
      rateFromPrevious: rate(counts.addedToCart, counts.productViewed),
      rateFromProductView: rate(counts.addedToCart, counts.productViewed),
    },
    {
      eventName: "checkout_started",
      label: "Checkout started",
      visitors: counts.checkoutStarted,
      rateFromPrevious: rate(counts.checkoutStarted, counts.addedToCart),
      rateFromProductView: rate(counts.checkoutStarted, counts.productViewed),
    },
    {
      eventName: "checkout_completed",
      label: "Purchase completed",
      visitors: counts.checkoutCompleted,
      rateFromPrevious: rate(
        counts.checkoutCompleted,
        counts.checkoutStarted,
      ),
      rateFromProductView: rate(
        counts.checkoutCompleted,
        counts.productViewed,
      ),
    },
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
