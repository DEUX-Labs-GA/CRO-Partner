import { describe, expect, it } from "vitest";
import { calculateExperimentStatistics } from "./experiment-statistics";
import { recommendExperimentResult } from "./experiment-recommendations";

describe("experiment result recommendations", () => {
  it("recommends gathering more data for a feasible small sample", () => {
    const statistics = calculateExperimentStatistics({
      control: {
        visitors: 10,
        conversions: 1,
      },
      treatment: {
        visitors: 10,
        conversions: 2,
      },
    });

    const recommendation = recommendExperimentResult({
      statistics,
      plannedSampleReached: false,
      experimentFeasible: true,
    });

    expect(recommendation.action).toBe(
      "GATHER_MORE_DATA",
    );
  });

  it("recommends retesting when a small-sample experiment is not feasible", () => {
    const statistics = calculateExperimentStatistics({
      control: {
        visitors: 10,
        conversions: 1,
      },
      treatment: {
        visitors: 10,
        conversions: 2,
      },
    });

    const recommendation = recommendExperimentResult({
      statistics,
      plannedSampleReached: false,
      experimentFeasible: false,
    });

    expect(recommendation.action).toBe("RETEST");
  });

  it("recommends investigating a critical allocation problem", () => {
    const statistics = calculateExperimentStatistics({
      control: {
        visitors: 900,
        conversions: 90,
      },
      treatment: {
        visitors: 300,
        conversions: 60,
      },
    });

    const recommendation = recommendExperimentResult({
      statistics,
      plannedSampleReached: true,
      experimentFeasible: true,
    });

    expect(recommendation.action).toBe(
      "INVESTIGATE",
    );
  });

  it("does not recommend deployment before planned sample is reached", () => {
    const statistics = calculateExperimentStatistics({
      control: {
        visitors: 5000,
        conversions: 500,
      },
      treatment: {
        visitors: 5000,
        conversions: 650,
      },
    });

    const recommendation = recommendExperimentResult({
      statistics,
      plannedSampleReached: false,
      experimentFeasible: true,
    });

    expect(statistics.outcome).toBe(
      "TREATMENT_LEADING",
    );

    expect(recommendation.action).toBe(
      "GATHER_MORE_DATA",
    );
  });

  it("recommends deployment for a valid treatment winner after planned sample", () => {
    const statistics = calculateExperimentStatistics({
      control: {
        visitors: 5000,
        conversions: 500,
      },
      treatment: {
        visitors: 5000,
        conversions: 650,
      },
    });

    const recommendation = recommendExperimentResult({
      statistics,
      plannedSampleReached: true,
      experimentFeasible: true,
    });

    expect(recommendation.action).toBe("DEPLOY");
  });

  it("recommends stopping a valid losing treatment after planned sample", () => {
    const statistics = calculateExperimentStatistics({
      control: {
        visitors: 5000,
        conversions: 650,
      },
      treatment: {
        visitors: 5000,
        conversions: 500,
      },
    });

    const recommendation = recommendExperimentResult({
      statistics,
      plannedSampleReached: true,
      experimentFeasible: true,
    });

    expect(recommendation.action).toBe("STOP");
  });

  it("recommends retesting an impractical inconclusive experiment", () => {
    const statistics = calculateExperimentStatistics({
      control: {
        visitors: 500,
        conversions: 50,
      },
      treatment: {
        visitors: 500,
        conversions: 54,
      },
    });

    const recommendation = recommendExperimentResult({
      statistics,
      plannedSampleReached: true,
      experimentFeasible: false,
    });

    expect(statistics.outcome).toBe("INCONCLUSIVE");
    expect(recommendation.action).toBe("RETEST");
  });
});
