import prisma from "../db.server";

const EXPOSURE_EVENT = "cro_partner:experiment_exposure";

const OUTCOME_EVENTS = [
  "product_added_to_cart",
  "checkout_started",
  "checkout_completed",
] as const;

type OutcomeEventName = (typeof OUTCOME_EVENTS)[number];

type ExperimentResultEvent = {
  eventId: string;
  eventName: string;
  clientId: string | null;
  experimentId: string | null;
  experimentVariantId: string | null;
  occurredAt: Date;
  value: number | null;
  currency: string | null;
  orderId: string | null;
};

type VariantResult = {
  variantId: string;
  visitors: number;
  addedToCart: number;
  checkoutStarted: number;
  purchases: number;
  conversionRate: number | null;
  revenue: number;
  revenuePerVisitor: number | null;
};

export async function loadExperimentResults(
  shop: string,
  experimentId: string,
) {
  const events = await prisma.behaviorEvent.findMany({
    where: {
      shop,
      clientId: {
        not: null,
      },
      OR: [
        {
          eventName: EXPOSURE_EVENT,
          experimentId,
        },
        {
          eventName: {
            in: [...OUTCOME_EVENTS],
          },
        },
      ],
    },
    select: {
      eventId: true,
      eventName: true,
      clientId: true,
      experimentId: true,
      experimentVariantId: true,
      occurredAt: true,
      value: true,
      currency: true,
      orderId: true,
    },
    orderBy: {
      occurredAt: "asc",
    },
  });

  return summarizeExperimentResults(events, experimentId);
}

export function summarizeExperimentResults(
  events: ExperimentResultEvent[],
  experimentId: string,
) {
  const sortedEvents = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  /*
   * One client should have one sticky experiment assignment.
   * If conflicting variant exposures appear for the same client,
   * exclude that client rather than attributing outcomes incorrectly.
   */
  const exposureByClient = new Map<
    string,
    {
      variantId: string;
      occurredAt: Date;
    }
  >();

  const ambiguousClients = new Set<string>();

  for (const event of sortedEvents) {
    if (
      event.eventName !== EXPOSURE_EVENT ||
      event.experimentId !== experimentId ||
      !event.clientId ||
      !event.experimentVariantId
    ) {
      continue;
    }

    const existing = exposureByClient.get(event.clientId);

    if (
      existing &&
      existing.variantId !== event.experimentVariantId
    ) {
      ambiguousClients.add(event.clientId);
      continue;
    }

    if (!existing) {
      exposureByClient.set(event.clientId, {
        variantId: event.experimentVariantId,
        occurredAt: event.occurredAt,
      });
    }
  }

  for (const clientId of ambiguousClients) {
    exposureByClient.delete(clientId);
  }

  const outcomesByClient = new Map<
    string,
    {
      addedToCart: boolean;
      checkoutStarted: boolean;
      purchased: boolean;
      revenue: number;
      orderIds: Set<string>;
      purchaseEventIds: Set<string>;
    }
  >();

  let currency: string | null = null;

  for (const event of sortedEvents) {
    if (
      !event.clientId ||
      !isOutcomeEvent(event.eventName)
    ) {
      continue;
    }

    const exposure = exposureByClient.get(event.clientId);

    if (!exposure) {
      continue;
    }

    /*
     * Never attribute behavior that happened before the visitor
     * was actually exposed to the experiment.
     */
    if (event.occurredAt < exposure.occurredAt) {
      continue;
    }

    const outcome =
      outcomesByClient.get(event.clientId) ?? {
        addedToCart: false,
        checkoutStarted: false,
        purchased: false,
        revenue: 0,
        orderIds: new Set<string>(),
        purchaseEventIds: new Set<string>(),
      };

    if (event.eventName === "product_added_to_cart") {
      outcome.addedToCart = true;
    }

    if (event.eventName === "checkout_started") {
      outcome.checkoutStarted = true;
    }

    if (event.eventName === "checkout_completed") {
      outcome.purchased = true;

      /*
       * Prefer order ID for revenue deduplication. Fall back to event ID
       * when Shopify does not provide an order ID.
       */
      const alreadyCounted = event.orderId
        ? outcome.orderIds.has(event.orderId)
        : outcome.purchaseEventIds.has(event.eventId);

      if (!alreadyCounted) {
        outcome.revenue += event.value ?? 0;

        if (event.orderId) {
          outcome.orderIds.add(event.orderId);
        } else {
          outcome.purchaseEventIds.add(event.eventId);
        }

        currency ??= event.currency;
      }
    }

    outcomesByClient.set(event.clientId, outcome);
  }

  const variantVisitors = new Map<string, Set<string>>();

  for (const [clientId, exposure] of exposureByClient) {
    const visitors =
      variantVisitors.get(exposure.variantId) ??
      new Set<string>();

    visitors.add(clientId);
    variantVisitors.set(exposure.variantId, visitors);
  }

  const variants: VariantResult[] = [];

  for (const [variantId, visitors] of variantVisitors) {
    let addedToCart = 0;
    let checkoutStarted = 0;
    let purchases = 0;
    let revenue = 0;

    for (const clientId of visitors) {
      const outcome = outcomesByClient.get(clientId);

      if (!outcome) {
        continue;
      }

      if (outcome.addedToCart) {
        addedToCart += 1;
      }

      if (outcome.checkoutStarted) {
        checkoutStarted += 1;
      }

      if (outcome.purchased) {
        purchases += 1;
      }

      revenue += outcome.revenue;
    }

    variants.push({
      variantId,
      visitors: visitors.size,
      addedToCart,
      checkoutStarted,
      purchases,
      conversionRate: rate(purchases, visitors.size),
      revenue,
      revenuePerVisitor:
        visitors.size > 0 ? revenue / visitors.size : null,
    });
  }

  variants.sort((a, b) =>
    a.variantId.localeCompare(b.variantId),
  );

  return {
    experimentId,
    variants,
    currency,
    totalExposedVisitors: exposureByClient.size,
    excludedAmbiguousVisitors: ambiguousClients.size,
  };
}

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function isOutcomeEvent(
  value: string,
): value is OutcomeEventName {
  return OUTCOME_EVENTS.includes(
    value as OutcomeEventName,
  );
}
