import type { ExperimentStatus } from "@prisma/client";

const ALLOWED_TRANSITIONS: Record<
  ExperimentStatus,
  ExperimentStatus[]
> = {
  DRAFT: ["READY"],
  READY: ["DRAFT", "RUNNING"],
  RUNNING: ["PAUSED", "COMPLETED"],
  PAUSED: ["RUNNING", "COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function getAllowedExperimentTransitions(
  status: ExperimentStatus,
): ExperimentStatus[] {
  return ALLOWED_TRANSITIONS[status];
}

export function canTransitionExperiment(
  currentStatus: ExperimentStatus,
  nextStatus: ExperimentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function isExperimentStatus(
  value: unknown,
): value is ExperimentStatus {
  return (
    typeof value === "string" &&
    [
      "DRAFT",
      "READY",
      "RUNNING",
      "PAUSED",
      "COMPLETED",
      "ARCHIVED",
    ].includes(value)
  );
}
