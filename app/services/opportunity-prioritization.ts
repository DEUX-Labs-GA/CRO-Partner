export type PriorityConfidence =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export type PriorityImpact =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export type PriorityInputs = {
  reach: number;
  impact: PriorityImpact;
  confidence: PriorityConfidence;
  effort: number;
};

export type PriorityResult = {
  reach: number;
  impactScore: number;
  confidenceScore: number;
  effort: number;
  priorityScore: number;
};

const IMPACT_SCORES: Record<
  PriorityImpact,
  number
> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

const CONFIDENCE_SCORES: Record<
  PriorityConfidence,
  number
> = {
  LOW: 0.5,
  MEDIUM: 0.75,
  HIGH: 1,
};

export function calculateOpportunityPriority(
  input: PriorityInputs,
): PriorityResult {
  const reach = Math.max(
    0,
    Math.floor(input.reach),
  );

  const effort =
    Number.isFinite(input.effort) &&
    input.effort > 0
      ? input.effort
      : 1;

  const impactScore =
    IMPACT_SCORES[input.impact];

  const confidenceScore =
    CONFIDENCE_SCORES[input.confidence];

  const priorityScore =
    (reach *
      impactScore *
      confidenceScore) /
    effort;

  return {
    reach,
    impactScore,
    confidenceScore,
    effort,
    priorityScore,
  };
}
