import { describe, expect, it } from "vitest";
import { buildCompletionInterpretation } from "./experiment-completion-interpretation";

describe("completion interpretation", () => {
  it.each([
    "NO_DIFFERENCE",
    "TREATMENT_LEADING",
    "CONTROL_LEADING",
    "INCONCLUSIVE",
  ] as const)("keeps %s provisional before planned sample", (outcome) => {
    expect(buildCompletionInterpretation(outcome, false)).toBe(
      "The planned sample was not confirmed as reached. Observed results are provisional and do not support a final directional conclusion.",
    );
  });

  it("does not claim equivalence from no significant difference", () => {
    expect(buildCompletionInterpretation("NO_DIFFERENCE", true)).toBe(
      "The experiment reached its planned sample without detecting a statistically significant difference. This does not establish equivalence.",
    );
  });

  it.each([false, true])("preserves insufficient-data limits (%s)", (reached) => {
    expect(buildCompletionInterpretation("INSUFFICIENT_DATA", reached)).toBe(
      "There was not enough analyzable evidence for a directional conclusion.",
    );
  });

  it.each([
    ["TREATMENT_LEADING", "The treatment produced a reliable directional advantage over control."],
    ["CONTROL_LEADING", "Control produced a reliable directional advantage over the treatment."],
    ["INCONCLUSIVE", "The experiment did not produce a reliable directional result."],
  ] as const)("preserves reached-sample interpretation for %s", (outcome, expected) => {
    expect(buildCompletionInterpretation(outcome, true)).toBe(expected);
  });
});
