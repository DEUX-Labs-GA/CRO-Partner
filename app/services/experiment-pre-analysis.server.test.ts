import { describe, expect, it } from "vitest";
import {
  assessPreAnalysis,
  calculateFeasibility,
  type FeasibilityAssumptions,
  type StoreBaseline,
} from "./experiment-pre-analysis.server";

const assumptions: FeasibilityAssumptions = {
  baselineConversionRate: 0.05,
  minimumDetectableEffect: 0.2,
  significanceLevel: 0.95,
  statisticalPower: 0.8,
};

function baseline(recentOrderCount: number | null): StoreBaseline {
  return {
    shopName: "Test shop",
    currency: "USD",
    productCount: 10,
    recentOrderCount,
    orderDataAvailable: recentOrderCount !== null,
    ordersPerDay: recentOrderCount === null ? null : recentOrderCount / 30,
    orderWindow: {
      days: 30,
      startDate: "2026-08-01",
      label: "Last 30 days",
    },
  };
}

describe("experiment feasibility calculator", () => {
  it("returns insufficient data when baseline conversion rate is missing", () => {
    const result = assessPreAnalysis(baseline(1_000), {
      ...assumptions,
      baselineConversionRate: null,
    });

    expect(result.readiness).toBe("INSUFFICIENT_DATA");
    expect(result.estimate).toBeNull();
  });

  it("returns insufficient data when order volume is zero", () => {
    const result = assessPreAnalysis(baseline(0), assumptions);

    expect(result.readiness).toBe("INSUFFICIENT_DATA");
    expect(calculateFeasibility(baseline(0), assumptions)).toBeNull();
  });

    it("classifies a long-duration estimate as low volume", () => {
    const result = assessPreAnalysis(baseline(300), assumptions);

    expect(result.readiness).toBe("LOW_VOLUME");
    expect(result.estimate?.estimatedDurationDays).toBeGreaterThan(42);
    });

it("classifies a shorter-duration estimate as ready", () => {
  const result = assessPreAnalysis(baseline(1_000), assumptions);

  expect(result.readiness).toBe("READY_FOR_ESTIMATION");
  expect(result.estimate?.estimatedDurationDays).toBeLessThanOrEqual(42);
});

  it("rejects an invalid MDE", () => {
    expect(calculateFeasibility(baseline(1_000), {
      ...assumptions,
      minimumDetectableEffect: 0,
    })).toBeNull();
  });

  it("rejects an invalid conversion rate", () => {
    expect(calculateFeasibility(baseline(1_000), {
      ...assumptions,
      baselineConversionRate: 1,
    })).toBeNull();
  });
});
