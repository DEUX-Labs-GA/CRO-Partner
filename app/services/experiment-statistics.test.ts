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

  it("warns when ambiguous visitors were excluded", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 100,
        conversions: 10,
      },
      treatment: {
        visitors: 100,
        conversions: 12,
      },
      excludedAmbiguousVisitors: 3,
    });

    const check = result.validityChecks.find(
      (item) => item.id === "AMBIGUOUS_VISITORS",
    );

    expect(check?.status).toBe("WARNING");
    expect(result.hasValidityWarnings).toBe(true);
  });

  it("does not evaluate allocation balance before 100 visitors", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 40,
        conversions: 4,
      },
      treatment: {
        visitors: 40,
        conversions: 5,
      },
    });

    const check = result.validityChecks.find(
      (item) => item.id === "ALLOCATION_BALANCE",
    );

    expect(result.allocationPValue).toBeNull();
    expect(check?.status).toBe("NOT_APPLICABLE");
  });

  it("passes a balanced 50/50 allocation", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 500,
        conversions: 50,
      },
      treatment: {
        visitors: 500,
        conversions: 55,
      },
    });

    const check = result.validityChecks.find(
      (item) => item.id === "ALLOCATION_BALANCE",
    );

    expect(result.allocationPValue).not.toBeNull();
    expect(check?.status).toBe("PASS");
  });

  it("warns on a severe sample-ratio mismatch", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 700,
        conversions: 70,
      },
      treatment: {
        visitors: 300,
        conversions: 30,
      },
    });

    const check = result.validityChecks.find(
      (item) => item.id === "ALLOCATION_BALANCE",
    );

    expect(result.allocationPValue).not.toBeNull();
    expect(result.allocationPValue!).toBeLessThan(0.01);
    expect(check?.status).toBe("WARNING");
    expect(result.hasValidityWarnings).toBe(true);
  });

  it("warns when the confidence interval crosses zero", () => {
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

    const check = result.validityChecks.find(
      (item) => item.id === "CONFIDENCE_INTERVAL",
    );

    expect(check?.status).toBe("WARNING");
  });


  it("does not declare a directional result when allocation is invalid", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 900,
        conversions: 90,
      },
      treatment: {
        visitors: 300,
        conversions: 60,
      },
    });

    expect(result.statisticallySignificant).toBe(true);
    expect(result.hasCriticalValidityIssue).toBe(true);
    expect(result.canDeclareDirectionalResult).toBe(false);
    expect(result.outcome).toBe("INCONCLUSIVE");
  });

  it("allows ambiguous-visitor warnings without blocking a valid directional result", () => {
    const result = calculateExperimentStatistics({
      control: {
        visitors: 5000,
        conversions: 500,
      },
      treatment: {
        visitors: 5000,
        conversions: 650,
      },
      excludedAmbiguousVisitors: 3,
    });

    expect(result.hasValidityWarnings).toBe(true);
    expect(result.hasCriticalValidityIssue).toBe(false);
    expect(result.canDeclareDirectionalResult).toBe(true);
    expect(result.outcome).toBe("TREATMENT_LEADING");
  });

});
