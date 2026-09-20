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
  outcome: ExperimentOutcome;
};

const MINIMUM_DIRECTIONAL_SAMPLE_PER_VARIANT = 30;

export function calculateExperimentStatistics({
  control,
  treatment,
  confidenceLevel = 0.95,
}: {
  control: StatisticalVariant;
  treatment: StatisticalVariant;
  confidenceLevel?: number;
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
    outcome,
  };
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
