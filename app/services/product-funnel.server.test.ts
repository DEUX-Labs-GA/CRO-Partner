import { describe, expect, it } from "vitest";
import { summarizeProductFunnel } from "./product-funnel.server";

const windowStart = new Date("2026-09-01T00:00:00.000Z");

function event(
  eventName: string,
  clientId: string,
  occurredAt: string,
  value: number | null = null,
) {
  return {
    eventName,
    clientId,
    value,
    currency: value === null ? null : "USD",
    occurredAt: new Date(occurredAt),
  };
}

describe("product funnel", () => {
  it("counts a complete sequential visitor journey", () => {
    const result = summarizeProductFunnel(
      [
        event("product_viewed", "visitor-1", "2026-09-10T10:00:00Z"),
        event("product_added_to_cart", "visitor-1", "2026-09-10T10:01:00Z"),
        event("checkout_started", "visitor-1", "2026-09-10T10:02:00Z"),
        event(
          "checkout_completed",
          "visitor-1",
          "2026-09-10T10:03:00Z",
          100,
        ),
      ],
      windowStart,
    );

    expect(result.steps.map((step) => step.visitors)).toEqual([
      1, 1, 1, 1,
    ]);
    expect(result.purchases).toBe(1);
    expect(result.totalRevenue).toBe(100);
    expect(result.overallConversionRate).toBe(1);
  });

  it("does not count later stages when earlier stages were not tracked", () => {
    const result = summarizeProductFunnel(
      [
        event("product_viewed", "visitor-1", "2026-09-10T10:00:00Z"),
        event("checkout_started", "visitor-1", "2026-09-10T10:01:00Z"),
        event(
          "checkout_completed",
          "visitor-1",
          "2026-09-10T10:02:00Z",
          100,
        ),
        event(
          "checkout_completed",
          "visitor-2",
          "2026-09-10T10:03:00Z",
          200,
        ),
      ],
      windowStart,
    );

    expect(result.steps.map((step) => step.visitors)).toEqual([
      1, 0, 0, 0,
    ]);
    expect(result.purchases).toBe(0);
    expect(result.totalRevenue).toBe(0);
  });

  it("calculates step drop-off", () => {
    const result = summarizeProductFunnel(
      [
        event("product_viewed", "visitor-1", "2026-09-10T10:00:00Z"),
        event("product_viewed", "visitor-2", "2026-09-10T10:00:01Z"),
        event("product_added_to_cart", "visitor-1", "2026-09-10T10:01:00Z"),
      ],
      windowStart,
    );

    expect(result.steps[1].visitors).toBe(1);
    expect(result.steps[1].rateFromPrevious).toBe(0.5);
    expect(result.steps[1].dropOffFromPrevious).toBe(1);
    expect(result.steps[1].dropOffRateFromPrevious).toBe(0.5);
  });

  it("counts a visitor only once per funnel stage", () => {
    const result = summarizeProductFunnel(
      [
        event("product_viewed", "visitor-1", "2026-09-10T10:00:00Z"),
        event("product_viewed", "visitor-1", "2026-09-10T10:00:10Z"),
        event("product_added_to_cart", "visitor-1", "2026-09-10T10:01:00Z"),
        event("product_added_to_cart", "visitor-1", "2026-09-10T10:01:10Z"),
      ],
      windowStart,
    );

    expect(result.steps[0].visitors).toBe(1);
    expect(result.steps[1].visitors).toBe(1);
  });
});
