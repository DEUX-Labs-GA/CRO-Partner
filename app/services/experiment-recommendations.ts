import type { ExperimentStatistics } from "./experiment-statistics";

export type ResultRecommendationAction =
  | "DEPLOY"
  | "STOP"
  | "ITERATE"
  | "RETEST"
  | "INVESTIGATE"
  | "SEGMENT"
  | "GATHER_MORE_DATA";

export type ResultRecommendation = {
  action: ResultRecommendationAction;
  title: string;
  rationale: string;
};

export function recommendExperimentResult({
  statistics,
  plannedSampleReached,
  experimentFeasible,
}: {
  statistics: ExperimentStatistics;
  plannedSampleReached: boolean;
  experimentFeasible: boolean | null;
}): ResultRecommendation {
  /*
   * Small samples are not treated as experiment failures.
   * If the current configuration is feasible, continue gathering data.
   * If it is not feasible, recommend a redesigned/retested setup.
   */
  if (statistics.outcome === "INSUFFICIENT_DATA") {
    if (experimentFeasible === false) {
      return {
        action: "RETEST",
        title: "Rework the experiment before continuing",
        rationale:
          "There is not enough evidence for a directional decision, and the current traffic level is unlikely to reach the required sample efficiently. Adjust the experiment design, detectable effect, targeting, or traffic scope before running it again.",
      };
    }

    return {
      action: "GATHER_MORE_DATA",
      title: "Keep collecting data",
      rationale:
        "There is not enough evidence to call a winner yet. Continue the experiment if the planned sample is realistically achievable.",
    };
  }

  /*
   * Critical validity problems take priority over the observed result.
   * A statistically strong number is not actionable if the experiment
   * itself is not trustworthy.
   */
  if (statistics.hasCriticalValidityIssue) {
    return {
      action: "INVESTIGATE",
      title: "Investigate experiment validity",
      rationale:
        "A critical validity issue is preventing a reliable directional decision. Review traffic allocation, exposure quality, and experiment setup before acting on the observed result.",
    };
  }

  /*
   * We deliberately do not recommend rollout or stopping solely because
   * a p-value crossed a threshold. Until the planned sample is reached,
   * directional results remain a reason to monitor rather than act.
   */
  if (!plannedSampleReached) {
    if (experimentFeasible === false) {
      return {
        action: "RETEST",
        title: "Rework the experiment design",
        rationale:
          "The experiment has not reached its planned sample and the current traffic level makes the remaining runtime impractical. Consider a larger detectable effect, broader eligible traffic, or a higher-volume target before retesting.",
      };
    }

    return {
      action: "GATHER_MORE_DATA",
      title: "Keep collecting data",
      rationale:
        "The current result is directional, but the experiment has not yet reached its planned sample. Continue collecting data before making a final rollout or stop decision.",
    };
  }

  switch (statistics.outcome) {
    case "TREATMENT_LEADING":
      return {
        action: "DEPLOY",
        title: "Consider deploying the treatment",
        rationale:
          "The treatment is outperforming control, the experiment passed the current validity checks, and the planned sample has been reached. Review business impact and implementation risk before rollout.",
      };

    case "CONTROL_LEADING":
      return {
        action: "STOP",
        title: "Stop the treatment",
        rationale:
          "Control is outperforming the treatment after the planned sample was reached and the experiment passed the current validity checks. Do not roll out the treatment without a compelling non-conversion reason.",
      };

    case "NO_DIFFERENCE":
      return {
        action: "ITERATE",
        title: "Iterate on the hypothesis",
        rationale:
          "The planned sample has been reached without a meaningful performance advantage. Use the result to refine the hypothesis or test a stronger variation.",
      };

    case "INCONCLUSIVE":
      if (experimentFeasible === false) {
        return {
          action: "RETEST",
          title: "Retest with a more feasible setup",
          rationale:
            "The result remains inconclusive and the current traffic level makes further collection impractical. Adjust the experiment design before running another test.",
        };
      }

      return {
        action: "GATHER_MORE_DATA",
        title: "Gather more evidence",
        rationale:
          "The result remains inconclusive. Additional data may help resolve the uncertainty if continuing the experiment is still practical.",
      };
  }
}
