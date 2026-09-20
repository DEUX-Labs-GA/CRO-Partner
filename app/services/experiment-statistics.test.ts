import { describe, expect, it } from "vitest";
import { calculateExperimentStatistics } from "./experiment-statistics";

describe("experiment statistics", () => {
  it("marks very small samples as insufficient", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 3,
        conversions: 1,
      },
      treatment: {
        visitors: 1,
        conversions: 0,
      },
    });

    expect(result.sampleSizeValid).toBe(false);
    expect(result.outcome).toBe(
      "INSUFFICIENT_DATA",
    );

    expect(result.controlConversionRate).toBeCloseTo(
      1 / 3,
    );

    expect(result.treatmentConversionRate).toBe(0);

    expect(result.absoluteLift).toBeCloseTo(
      -(1 / 3),
    );
  });

  it("calculates positive absolute and relative lift", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 1000,
        conversions: 100,
      },
      treatment: {
        visitors: 1000,
        conversions: 130,
      },
    });

    expect(result.controlConversionRate).toBeCloseTo(
      0.1,
    );

    expect(
      result.treatmentConversionRate,
    ).toBeCloseTo(0.13);

    expect(result.absoluteLift).toBeCloseTo(0.03);

    expect(result.relativeLift).toBeCloseTo(0.3);
  });

  it("classifies a strong treatment result", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 5000,
        conversions: 500,
      },
      treatment: {
        visitors: 5000,
        conversions: 650,
      },
    });

    expect(result.sampleSizeValid).toBe(true);
    expect(
      result.statisticallySignificant,
    ).toBe(true);
    expect(result.outcome).toBe(
      "TREATMENT_LEADING",
    );
    expect(result.pValue).toBeLessThan(0.05);
  });

  it("classifies a strong control result", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 5000,
        conversions: 650,
      },
      treatment: {
        visitors: 5000,
        conversions: 500,
      },
    });

    expect(result.outcome).toBe(
      "CONTROL_LEADING",
    );
  });

  it("keeps non-significant results inconclusive", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 500,
        conversions: 50,
      },
      treatment: {
        visitors: 500,
        conversions: 54,
      },
    });

    expect(result.sampleSizeValid).toBe(true);
    expect(
      result.statisticallySignificant,
    ).toBe(false);
    expect(result.outcome).toBe("INCONCLUSIVE");
  });

  it("returns no relative lift when control rate is zero", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 100,
        conversions: 0,
      },
      treatment: {
        visitors: 100,
        conversions: 5,
      },
    });

    expect(result.relativeLift).toBeNull();
  });
});
