export type StatisticalVariant = {
  visitors: number;
  conversions: number;
};

export type ExperimentOutcome =
  | "INSUFFICIENT_DATA"
  | "INCONCLUSIVE"
  | "TREATMENT_LEADING"
  | "CONTROL_LEADING"
  | "NO_DIFFERENCE";

export type ValidityCheckStatus =
  | "PASS"
  | "WARNING"
  | "NOT_APPLICABLE";

export type ValidityCheck = {
  id:
    | "MINIMUM_SAMPLE"
    | "ALLOCATION_BALANCE"
    | "AMBIGUOUS_VISITORS"
    | "CONFIDENCE_INTERVAL";
  status: ValidityCheckStatus;
  message: string;
};

export type ExperimentStatistics = {
  controlConversionRate: number | null;
  treatmentConversionRate: number | null;
  absoluteLift: number | null;
  relativeLift: number | null;
  confidenceLevel: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  } | null;
  pValue: number | null;
  statisticallySignificant: boolean;
  sampleSizeValid: boolean;
  allocationPValue: number | null;
  validityChecks: ValidityCheck[];
  hasValidityWarnings: boolean;
  outcome: ExperimentOutcome;
};

const MINIMUM_DIRECTIONAL_SAMPLE_PER_VARIANT = 30;

export function calculateExperimentStatistics({
  control,
  treatment,
  confidenceLevel = 0.95,
  excludedAmbiguousVisitors = 0,
}: {
  control: StatisticalVariant;
  treatment: StatisticalVariant;
  confidenceLevel?: number;
  excludedAmbiguousVisitors?: number;
}): ExperimentStatistics {
  const controlRate = rate(
    control.conversions,
    control.visitors,
  );

  const treatmentRate = rate(
    treatment.conversions,
    treatment.visitors,
  );

  if (
    controlRate === null ||
    treatmentRate === null
  ) {
    return {
      controlConversionRate: controlRate,
      treatmentConversionRate: treatmentRate,
      absoluteLift: null,
      relativeLift: null,
      confidenceLevel,
      confidenceInterval: null,
      pValue: null,
      statisticallySignificant: false,
      sampleSizeValid: false,
      allocationPValue: null,
      validityChecks: [
        {
          id: "MINIMUM_SAMPLE",
          status: "WARNING",
          message:
            "Both variants need exposed visitors before statistical comparison is available.",
        },
        {
          id: "ALLOCATION_BALANCE",
          status: "NOT_APPLICABLE",
          message:
            "Allocation balance is not evaluated until enough visitors have been exposed.",
        },
        {
          id: "AMBIGUOUS_VISITORS",
          status:
            excludedAmbiguousVisitors > 0
              ? "WARNING"
              : "PASS",
          message:
            excludedAmbiguousVisitors > 0
              ? `${excludedAmbiguousVisitors} ambiguous visitor(s) were excluded from the analysis.`
              : "No ambiguous visitors were excluded.",
        },
        {
          id: "CONFIDENCE_INTERVAL",
          status: "NOT_APPLICABLE",
          message:
            "A confidence interval is not available until both variants have exposures.",
        },
      ],
      hasValidityWarnings: true,
      outcome: "INSUFFICIENT_DATA",
    };
  }

  const absoluteLift = treatmentRate - controlRate;

  const relativeLift =
    controlRate === 0
      ? null
      : absoluteLift / controlRate;

  const alpha = 1 - confidenceLevel;
  const zCritical = inverseNormalCDF(
    1 - alpha / 2,
  );

  const standardError = Math.sqrt(
    (controlRate * (1 - controlRate)) /
      control.visitors +
      (treatmentRate * (1 - treatmentRate)) /
        treatment.visitors,
  );

  const confidenceInterval =
    Number.isFinite(standardError)
      ? {
          lower:
            absoluteLift -
            zCritical * standardError,
          upper:
            absoluteLift +
            zCritical * standardError,
        }
      : null;

  const pooledRate =
    (control.conversions +
      treatment.conversions) /
    (control.visitors + treatment.visitors);

  const pooledStandardError = Math.sqrt(
    pooledRate *
      (1 - pooledRate) *
      (1 / control.visitors +
        1 / treatment.visitors),
  );

  const zScore =
    pooledStandardError > 0
      ? absoluteLift / pooledStandardError
      : 0;

  const pValue =
    pooledStandardError > 0
      ? 2 * (1 - normalCDF(Math.abs(zScore)))
      : absoluteLift === 0
        ? 1
        : 0;

  const sampleSizeValid =
    control.visitors >=
      MINIMUM_DIRECTIONAL_SAMPLE_PER_VARIANT &&
    treatment.visitors >=
      MINIMUM_DIRECTIONAL_SAMPLE_PER_VARIANT;

  const totalVisitors =
    control.visitors + treatment.visitors;

  /*
   * Sample-ratio mismatch check for an intended 50/50 split.
   * Only evaluate after 100 total visitors so tiny samples do
   * not generate noisy allocation warnings.
   */
  const allocationPValue =
    totalVisitors >= 100
      ? calculateAllocationPValue(
          control.visitors,
          treatment.visitors,
        )
      : null;

  const allocationWarning =
    allocationPValue !== null &&
    allocationPValue < 0.01;

  const confidenceIntervalCrossesZero =
    confidenceInterval !== null &&
    confidenceInterval.lower <= 0 &&
    confidenceInterval.upper >= 0;

  const validityChecks: ValidityCheck[] = [
    {
      id: "MINIMUM_SAMPLE",
      status: sampleSizeValid ? "PASS" : "WARNING",
      message: sampleSizeValid
        ? "Both variants meet the minimum directional sample floor."
        : `Each variant needs at least ${MINIMUM_DIRECTIONAL_SAMPLE_PER_VARIANT} exposed visitors before directional interpretation.`,
    },
    {
      id: "ALLOCATION_BALANCE",
      status:
        allocationPValue === null
          ? "NOT_APPLICABLE"
          : allocationWarning
            ? "WARNING"
            : "PASS",
      message:
        allocationPValue === null
          ? "Allocation balance will be evaluated after 100 total exposed visitors."
          : allocationWarning
            ? "The observed control/treatment allocation differs materially from the intended 50/50 split."
            : "Control/treatment allocation is consistent with the intended 50/50 split.",
    },
    {
      id: "AMBIGUOUS_VISITORS",
      status:
        excludedAmbiguousVisitors > 0
          ? "WARNING"
          : "PASS",
      message:
        excludedAmbiguousVisitors > 0
          ? `${excludedAmbiguousVisitors} ambiguous visitor(s) were excluded from the analysis.`
          : "No ambiguous visitors were excluded.",
    },
    {
      id: "CONFIDENCE_INTERVAL",
      status:
        confidenceIntervalCrossesZero
          ? "WARNING"
          : "PASS",
      message:
        confidenceIntervalCrossesZero
          ? "The confidence interval includes zero, so the observed difference is compatible with no true effect."
          : "The confidence interval does not include zero.",
    },
  ];

  const hasValidityWarnings =
    validityChecks.some(
      (check) => check.status === "WARNING",
    );

  const statisticallySignificant =
    pValue < alpha;

  let outcome: ExperimentOutcome;

  if (!sampleSizeValid) {
    outcome = "INSUFFICIENT_DATA";
  } else if (!statisticallySignificant) {
    outcome =
      absoluteLift === 0
        ? "NO_DIFFERENCE"
        : "INCONCLUSIVE";
  } else if (absoluteLift > 0) {
    outcome = "TREATMENT_LEADING";
  } else if (absoluteLift < 0) {
    outcome = "CONTROL_LEADING";
  } else {
    outcome = "NO_DIFFERENCE";
  }

  return {
    controlConversionRate: controlRate,
    treatmentConversionRate: treatmentRate,
    absoluteLift,
    relativeLift,
    confidenceLevel,
    confidenceInterval,
    pValue,
    statisticallySignificant,
    sampleSizeValid,
    allocationPValue,
    validityChecks,
    hasValidityWarnings,
    outcome,
  };
}

function calculateAllocationPValue(
  controlVisitors: number,
  treatmentVisitors: number,
) {
  const total =
    controlVisitors + treatmentVisitors;

  if (total <= 0) {
    return null;
  }

  const expected = total / 2;
  const standardDeviation =
    Math.sqrt(total * 0.25);

  if (standardDeviation === 0) {
    return null;
  }

  const zScore =
    (controlVisitors - expected) /
    standardDeviation;

  return (
    2 *
    (1 - normalCDF(Math.abs(zScore)))
  );
}

function rate(
  conversions: number,
  visitors: number,
) {
  if (visitors <= 0) {
    return null;
  }

  return conversions / visitors;
}

/*
 * Standard normal cumulative distribution function.
 * Abramowitz-Stegun approximation.
 */
function normalCDF(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);

  const t = 1 / (1 + 0.3275911 * x);

  const erf =
    1 -
    (
      0.254829592 * t -
      0.284496736 * t ** 2 +
      1.421413741 * t ** 3 -
      1.453152027 * t ** 4 +
      1.061405429 * t ** 5
    ) *
      Math.exp(-(x ** 2));

  return 0.5 * (1 + sign * erf);
}

/*
 * Peter John Acklam approximation for the inverse
 * standard-normal cumulative distribution function.
 */
function inverseNormalCDF(probability: number) {
  if (
    probability <= 0 ||
    probability >= 1
  ) {
    throw new Error(
      "Probability must be between 0 and 1.",
    );
  }

  const a = [
    -39.69683028665376,
    220.9460984245205,
    -275.9285104469687,
    138.357751867269,
    -30.66479806614716,
    2.506628277459239,
  ];

  const b = [
    -54.47609879822406,
    161.5858368580409,
    -155.6989798598866,
    66.80131188771972,
    -13.28068155288572,
  ];

  const c = [
    -0.007784894002430293,
    -0.3223964580411365,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];

  const d = [
    0.007784695709041462,
    0.3224671290700398,
    2.445134137142996,
    3.754408661907416,
  ];

  const lower = 0.02425;
  const upper = 1 - lower;

  if (probability < lower) {
    const q = Math.sqrt(
      -2 * Math.log(probability),
    );

    return (
      (((((c[0] * q + c[1]) * q + c[2]) *
        q +
        c[3]) *
        q +
        c[4]) *
        q +
        c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) *
        q +
        d[3]) *
        q +
        1)
    );
  }

  if (probability > upper) {
    const q = Math.sqrt(
      -2 * Math.log(1 - probability),
    );

    return -(
      (((((c[0] * q + c[1]) * q + c[2]) *
        q +
        c[3]) *
        q +
        c[4]) *
        q +
        c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) *
        q +
        d[3]) *
        q +
        1)
    );
  }

  const q = probability - 0.5;
  const r = q * q;

  return (
    (((((a[0] * r + a[1]) * r + a[2]) *
      r +
      a[3]) *
      r +
      a[4]) *
      r +
      a[5]) *
    q /
    (((((b[0] * r + b[1]) * r + b[2]) *
      r +
      b[3]) *
      r +
      b[4]) *
      r +
      1)
  );
}
