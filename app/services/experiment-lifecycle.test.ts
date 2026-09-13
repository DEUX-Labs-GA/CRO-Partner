import { describe, expect, it } from "vitest";
import {
  canTransitionExperiment,
  getAllowedExperimentTransitions,
  isExperimentStatus,
} from "./experiment-lifecycle";

describe("experiment lifecycle", () => {
  it("allows draft experiments to become ready", () => {
    expect(canTransitionExperiment("DRAFT", "READY")).toBe(true);
  });

  it("allows ready experiments to launch or return to draft", () => {
    expect(getAllowedExperimentTransitions("READY")).toEqual([
      "DRAFT",
      "RUNNING",
    ]);
  });

  it("allows running experiments to pause or complete", () => {
    expect(getAllowedExperimentTransitions("RUNNING")).toEqual([
      "PAUSED",
      "COMPLETED",
    ]);
  });

  it("allows paused experiments to resume or complete", () => {
    expect(getAllowedExperimentTransitions("PAUSED")).toEqual([
      "RUNNING",
      "COMPLETED",
    ]);
  });

  it("only allows completed experiments to archive", () => {
    expect(getAllowedExperimentTransitions("COMPLETED")).toEqual([
      "ARCHIVED",
    ]);
  });

  it("does not allow archived experiments to transition", () => {
    expect(getAllowedExperimentTransitions("ARCHIVED")).toEqual([]);
  });

  it("recognizes valid lifecycle statuses", () => {
    expect(isExperimentStatus("RUNNING")).toBe(true);
    expect(isExperimentStatus("BANANAS")).toBe(false);
  });
});
