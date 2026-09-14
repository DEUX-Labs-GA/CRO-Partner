import { describe, expect, it } from "vitest";
import { summarizeExperimentResults } from "./experiment-results.server";

function event(
  overrides: Partial<{
    eventId: string;
    eventName: string;
    clientId: string | null;
    experimentId: string | null;
    experimentVariantId: string | null;
    occurredAt: Date;
    value: number | null;
    currency: string | null;
    orderId: string | null;
  }>,
) {
  return {
    eventId: "event-1",
    eventName: "product_added_to_cart",
    clientId: "client-1",
    experimentId: null,
    experimentVariantId: null,
    occurredAt: new Date("2026-09-12T20:00:00.000Z"),
    value: null,
    currency: null,
    orderId: null,
    ...overrides,
  };
}

describe("experiment results", () => {
  it("attributes downstream outcomes to an exposed variant", () => {
    const result = summarizeExperimentResults(
      [
        event({
          eventId: "exposure-1",
          eventName: "cro_partner:experiment_exposure",
          experimentId: "experiment-1",
          experimentVariantId: "variant-a",
          occurredAt: new Date("2026-09-12T20:00:00.000Z"),
        }),
        event({
          eventId: "cart-1",
          eventName: "product_added_to_cart",
          occurredAt: new Date("2026-09-12T20:01:00.000Z"),
        }),
        event({
          eventId: "checkout-1",
          eventName: "checkout_started",
          occurredAt: new Date("2026-09-12T20:02:00.000Z"),
        }),
        event({
          eventId: "purchase-1",
          eventName: "checkout_completed",
          orderId: "order-1",
          value: 600,
          currency: "USD",
          occurredAt: new Date("2026-09-12T20:03:00.000Z"),
        }),
      ],
      "experiment-1",
    );

    expect(result.totalExposedVisitors).toBe(1);
    expect(result.variants).toEqual([
      {
        variantId: "variant-a",
        visitors: 1,
        addedToCart: 1,
        checkoutStarted: 1,
        purchases: 1,
        conversionRate: 1,
        revenue: 600,
        revenuePerVisitor: 600,
      },
    ]);
    expect(result.currency).toBe("USD");
  });

  it("does not attribute outcomes that occurred before exposure", () => {
    const result = summarizeExperimentResults(
      [
        event({
          eventId: "purchase-before",
          eventName: "checkout_completed",
          orderId: "order-before",
          value: 600,
          currency: "USD",
          occurredAt: new Date("2026-09-12T19:59:00.000Z"),
        }),
        event({
          eventId: "exposure-1",
          eventName: "cro_partner:experiment_exposure",
          experimentId: "experiment-1",
          experimentVariantId: "variant-a",
          occurredAt: new Date("2026-09-12T20:00:00.000Z"),
        }),
      ],
      "experiment-1",
    );

    expect(result.variants[0]).toMatchObject({
      visitors: 1,
      purchases: 0,
      revenue: 0,
    });
  });

  it("deduplicates revenue by order ID", () => {
    const result = summarizeExperimentResults(
      [
        event({
          eventId: "exposure-1",
          eventName: "cro_partner:experiment_exposure",
          experimentId: "experiment-1",
          experimentVariantId: "variant-a",
        }),
        event({
          eventId: "purchase-1",
          eventName: "checkout_completed",
          orderId: "order-1",
          value: 600,
          currency: "USD",
          occurredAt: new Date("2026-09-12T20:01:00.000Z"),
        }),
        event({
          eventId: "purchase-2",
          eventName: "checkout_completed",
          orderId: "order-1",
          value: 600,
          currency: "USD",
          occurredAt: new Date("2026-09-12T20:02:00.000Z"),
        }),
      ],
      "experiment-1",
    );

    expect(result.variants[0]).toMatchObject({
      purchases: 1,
      revenue: 600,
    });
  });

  it("excludes a client exposed to conflicting variants", () => {
    const result = summarizeExperimentResults(
      [
        event({
          eventId: "exposure-a",
          eventName: "cro_partner:experiment_exposure",
          experimentId: "experiment-1",
          experimentVariantId: "variant-a",
        }),
        event({
          eventId: "exposure-control",
          eventName: "cro_partner:experiment_exposure",
          experimentId: "experiment-1",
          experimentVariantId: "control",
          occurredAt: new Date("2026-09-12T20:01:00.000Z"),
        }),
      ],
      "experiment-1",
    );

    expect(result.totalExposedVisitors).toBe(0);
    expect(result.excludedAmbiguousVisitors).toBe(1);
    expect(result.variants).toEqual([]);
  });
  it("stops attribution when a client enters a different experiment", () => {
    const result = summarizeExperimentResults(
      [
        event({
          eventId: "old-exposure",
          eventName: "cro_partner:experiment_exposure",
          experimentId: "experiment-1",
          experimentVariantId: "variant-a",
          occurredAt: new Date("2026-09-12T20:00:00.000Z"),
        }),
        event({
          eventId: "old-purchase",
          eventName: "checkout_completed",
          orderId: "order-old",
          value: 100,
          currency: "USD",
          occurredAt: new Date("2026-09-12T20:01:00.000Z"),
        }),
        event({
          eventId: "new-exposure",
          eventName: "cro_partner:experiment_exposure",
          experimentId: "experiment-2",
          experimentVariantId: "variant-a",
          occurredAt: new Date("2026-09-12T20:02:00.000Z"),
        }),
        event({
          eventId: "new-purchase",
          eventName: "checkout_completed",
          orderId: "order-new",
          value: 600,
          currency: "USD",
          occurredAt: new Date("2026-09-12T20:03:00.000Z"),
        }),
      ],
      "experiment-1",
    );

    expect(result.variants[0]).toMatchObject({
      purchases: 1,
      revenue: 100,
    });
  });

  it("attributes outcomes after exposure to the newer experiment", () => {
    const result = summarizeExperimentResults(
      [
        event({
          eventId: "old-exposure",
          eventName: "cro_partner:experiment_exposure",
          experimentId: "experiment-1",
          experimentVariantId: "variant-a",
          occurredAt: new Date("2026-09-12T20:00:00.000Z"),
        }),
        event({
          eventId: "new-exposure",
          eventName: "cro_partner:experiment_exposure",
          experimentId: "experiment-2",
          experimentVariantId: "variant-a",
          occurredAt: new Date("2026-09-12T20:02:00.000Z"),
        }),
        event({
          eventId: "new-purchase",
          eventName: "checkout_completed",
          orderId: "order-new",
          value: 600,
          currency: "USD",
          occurredAt: new Date("2026-09-12T20:03:00.000Z"),
        }),
      ],
      "experiment-2",
    );

    expect(result.variants[0]).toMatchObject({
      purchases: 1,
      revenue: 600,
    });
  });

});
