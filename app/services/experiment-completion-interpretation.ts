export function buildCompletionInterpretation(
  outcome:
    | "INSUFFICIENT_DATA"
    | "INCONCLUSIVE"
    | "TREATMENT_LEADING"
    | "CONTROL_LEADING"
    | "NO_DIFFERENCE",
  plannedSampleReached: boolean,
) {
  if (outcome !== "INSUFFICIENT_DATA" && !plannedSampleReached) {
    return "The planned sample was not confirmed as reached. Observed results are provisional and do not support a final directional conclusion.";
  }

  switch (outcome) {
    case "INSUFFICIENT_DATA":
      return "There was not enough analyzable evidence for a directional conclusion.";

    case "INCONCLUSIVE":
      return "The experiment did not produce a reliable directional result.";

    case "TREATMENT_LEADING":
      return "The treatment produced a reliable directional advantage over control.";

    case "CONTROL_LEADING":
      return "Control produced a reliable directional advantage over the treatment.";

    case "NO_DIFFERENCE":
      return "The experiment reached its planned sample without detecting a statistically significant difference. This does not establish equivalence.";
  }
}
