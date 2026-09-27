import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateOpportunityPriority,
} from "./opportunity-prioritization";

describe("opportunity prioritization", () => {
  it("calculates reach × impact × confidence ÷ effort", () => {
    const result =
      calculateOpportunityPriority({
        reach: 100,
        impact: "HIGH",
        confidence: "HIGH",
        effort: 2,
      });

    expect(result.priorityScore).toBe(150);
  });

  it("maps medium impact and confidence to numeric weights", () => {
    const result =
      calculateOpportunityPriority({
        reach: 80,
        impact: "MEDIUM",
        confidence: "MEDIUM",
        effort: 4,
      });

    expect(result.impactScore).toBe(2);
    expect(
      result.confidenceScore,
    ).toBe(0.75);
    expect(result.priorityScore).toBe(30);
  });

  it("maps low impact and confidence conservatively", () => {
    const result =
      calculateOpportunityPriority({
        reach: 40,
        impact: "LOW",
        confidence: "LOW",
        effort: 2,
      });

    expect(result.priorityScore).toBe(10);
  });

  it("prevents zero effort from dividing by zero", () => {
    const result =
      calculateOpportunityPriority({
        reach: 20,
        impact: "HIGH",
        confidence: "HIGH",
        effort: 0,
      });

    expect(result.effort).toBe(1);
    expect(result.priorityScore).toBe(60);
  });

  it("prevents negative reach", () => {
    const result =
      calculateOpportunityPriority({
        reach: -10,
        impact: "HIGH",
        confidence: "HIGH",
        effort: 1,
      });

    expect(result.reach).toBe(0);
    expect(result.priorityScore).toBe(0);
  });

  it("allows higher reach to outrank an otherwise identical opportunity", () => {
    const smaller =
      calculateOpportunityPriority({
        reach: 20,
        impact: "MEDIUM",
        confidence: "MEDIUM",
        effort: 2,
      });

    const larger =
      calculateOpportunityPriority({
        reach: 80,
        impact: "MEDIUM",
        confidence: "MEDIUM",
        effort: 2,
      });

    expect(
      larger.priorityScore,
    ).toBeGreaterThan(
      smaller.priorityScore,
    );
  });
});
