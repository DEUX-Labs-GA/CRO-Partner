export const CROChartColors = {
  control: "#616161",
  controlFill: "#d9d9d9",

  treatment: "#1473e6",
  treatmentFill: "#dbeafe",

  positive: "#15803d",
  positiveFill: "#dcfce7",

  warning: "#b45309",
  warningFill: "#fef3c7",

  negative: "#b42318",
  negativeFill: "#fee2e2",

  neutral: "#6b7280",
  neutralFill: "#f3f4f6",

  textPrimary: "#303030",
  textSecondary: "#616161",

  grid: "#e6e6e6",
  axis: "#b8b8b8",
  border: "#dcdcdc",
  surface: "#ffffff",
} as const;

export type CROSemanticState =
  | "positive"
  | "warning"
  | "negative"
  | "neutral";

export function getSemanticColor(
  state: CROSemanticState,
) {
  switch (state) {
    case "positive":
      return CROChartColors.positive;

    case "warning":
      return CROChartColors.warning;

    case "negative":
      return CROChartColors.negative;

    case "neutral":
      return CROChartColors.neutral;
  }
}

export function getSemanticFill(
  state: CROSemanticState,
) {
  switch (state) {
    case "positive":
      return CROChartColors.positiveFill;

    case "warning":
      return CROChartColors.warningFill;

    case "negative":
      return CROChartColors.negativeFill;

    case "neutral":
      return CROChartColors.neutralFill;
  }
}
