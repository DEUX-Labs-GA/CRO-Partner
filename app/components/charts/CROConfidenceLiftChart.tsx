type ExperimentOutcome =
  | "INSUFFICIENT_DATA"
  | "INCONCLUSIVE"
  | "TREATMENT_LEADING"
  | "CONTROL_LEADING"
  | "NO_DIFFERENCE";

type ConfidenceInterval = {
  lower: number;
  upper: number;
};

export type CROConfidenceLiftChartProps = {
  absoluteLift: number | null;
  relativeLift: number | null;
  confidenceInterval: ConfidenceInterval | null;
  confidenceLevel: number;
  outcome: ExperimentOutcome;
  hasCriticalValidityIssue: boolean;
};

function formatPercentagePoints(value: number) {
  const percentagePoints = value * 100;

  if (percentagePoints > 0) {
    return `+${percentagePoints.toFixed(2)} pp`;
  }

  if (percentagePoints < 0) {
    return `${percentagePoints.toFixed(2)} pp`;
  }

  return "0.00 pp";
}

function formatPercent(value: number) {
  const percent = value * 100;

  if (percent > 0) {
    return `+${percent.toFixed(2)}%`;
  }

  if (percent < 0) {
    return `${percent.toFixed(2)}%`;
  }

  return "0.00%";
}

function getHeadline(outcome: ExperimentOutcome) {
  switch (outcome) {
    case "INSUFFICIENT_DATA":
      return "There is not enough evidence to call a winner yet.";

    case "INCONCLUSIVE":
      return "The observed difference could still be noise.";

    case "TREATMENT_LEADING":
      return "The treatment is outperforming control with enough evidence to act.";

    case "CONTROL_LEADING":
      return "Control is outperforming the treatment with enough evidence to act.";

    case "NO_DIFFERENCE":
      return "The data is not showing a meaningful difference between variants.";
  }
}

function getExplanation({
  outcome,
  confidenceInterval,
}: {
  outcome: ExperimentOutcome;
  confidenceInterval: ConfidenceInterval;
}) {
  const crossesZero =
    confidenceInterval.lower <= 0 &&
    confidenceInterval.upper >= 0;

  if (crossesZero) {
    return "The plausible range includes both a loss and a gain. Because that range crosses the no-difference line, the observed lift could be caused by normal variation rather than the treatment.";
  }

  if (outcome === "TREATMENT_LEADING") {
    return "The plausible range stays above the no-difference line. That supports the conclusion that treatment is genuinely outperforming control.";
  }

  if (outcome === "CONTROL_LEADING") {
    return "The plausible range stays below the no-difference line. That supports the conclusion that control is genuinely outperforming treatment.";
  }

  return "The confidence interval shows the range of effects that remain reasonably compatible with the observed experiment data.";
}

function getRecommendation({
  outcome,
  hasCriticalValidityIssue,
}: {
  outcome: ExperimentOutcome;
  hasCriticalValidityIssue: boolean;
}) {
  if (hasCriticalValidityIssue) {
    return "Do not declare a winner yet. Resolve the validity or sample-size issue before making a directional decision.";
  }

  switch (outcome) {
    case "INSUFFICIENT_DATA":
      return "Keep collecting data if the experiment remains feasible. Treat the current result as directional only.";

    case "INCONCLUSIVE":
      return "Do not declare a winner yet. Continue the test if additional traffic can realistically resolve the uncertainty.";

    case "TREATMENT_LEADING":
      return "Treatment has enough statistical support for a directional decision. Review business impact and implementation risk before rollout.";

    case "CONTROL_LEADING":
      return "The treatment is underperforming control. Consider stopping the treatment or investigating why it reduced performance.";

    case "NO_DIFFERENCE":
      return "There is no clear performance advantage. Consider whether the treatment offers another business or customer benefit before proceeding.";
  }
}

export function CROConfidenceLiftChart({
  absoluteLift,
  relativeLift,
  confidenceInterval,
  confidenceLevel,
  outcome,
  hasCriticalValidityIssue,
}: CROConfidenceLiftChartProps) {
  if (
    absoluteLift === null ||
    confidenceInterval === null
  ) {
    return null;
  }

  const values = [
    confidenceInterval.lower,
    confidenceInterval.upper,
    absoluteLift,
    0,
  ];

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = Math.max(rawMax - rawMin, 0.01);
  const padding = Math.max(rawRange * 0.12, 0.01);

  const domainMin = rawMin - padding;
  const domainMax = rawMax + padding;
  const domainRange = domainMax - domainMin;

  const chartWidth = 800;
  const chartHeight = 180;
  const left = 64;
  const right = 40;
  const plotWidth =
    chartWidth - left - right;

  const intervalY = 70;
  const axisY = 122;

  const scaleX = (value: number) =>
    left +
    ((value - domainMin) /
      domainRange) *
      plotWidth;

  const lowerX =
    scaleX(confidenceInterval.lower);

  const upperX =
    scaleX(confidenceInterval.upper);

  const liftX =
    scaleX(absoluteLift);

  const zeroX =
    scaleX(0);

  const ticks = Array.from(
    { length: 5 },
    (_, index) =>
      domainMin +
      (domainRange * index) / 4,
  );

  const confidencePercent =
    Math.round(confidenceLevel * 100);

  return (
    <div
      style={{
        marginTop: "14px",
        marginBottom: "20px",
        border: "1px solid #dcdcdc",
        borderRadius: "12px",
        background: "#ffffff",
        padding: "18px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#616161",
          marginBottom: "4px",
        }}
      >
        What the data says
      </div>

      <div
        style={{
          fontSize: "18px",
          fontWeight: 650,
          lineHeight: 1.35,
          marginBottom: "8px",
        }}
      >
        {getHeadline(outcome)}
      </div>

      <div
        style={{
          fontSize: "13px",
          lineHeight: 1.55,
          color: "#4a4a4a",
          marginBottom: "18px",
          maxWidth: "760px",
        }}
      >
        {getExplanation({
          outcome,
          confidenceInterval,
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        <SummaryMetric
          label="Observed lift"
          value={formatPercentagePoints(
            absoluteLift,
          )}
        />

        <SummaryMetric
          label="Relative lift"
          value={
            relativeLift === null
              ? "Not available"
              : formatPercent(relativeLift)
          }
        />

        <SummaryMetric
          label={`${confidencePercent}% plausible range`}
          value={`${formatPercentagePoints(
            confidenceInterval.lower,
          )} to ${formatPercentagePoints(
            confidenceInterval.upper,
          )}`}
        />
      </div>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
        }}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label={`${confidencePercent}% confidence interval from ${formatPercentagePoints(
            confidenceInterval.lower,
          )} to ${formatPercentagePoints(
            confidenceInterval.upper,
          )}, with observed lift ${formatPercentagePoints(
            absoluteLift,
          )}.`}
          style={{
            width: "100%",
            minWidth: "620px",
            display: "block",
          }}
        >
          <line
            x1={zeroX}
            x2={zeroX}
            y1={24}
            y2={axisY}
            stroke="#8a8a8a"
            strokeWidth="2"
            strokeDasharray="5 5"
          />

          <text
            x={zeroX}
            y={18}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#616161"
          >
            No difference
          </text>

          <line
            x1={lowerX}
            x2={upperX}
            y1={intervalY}
            y2={intervalY}
            stroke="#8a8a8a"
            strokeWidth="8"
            strokeLinecap="round"
          />

          <line
            x1={lowerX}
            x2={lowerX}
            y1={intervalY - 12}
            y2={intervalY + 12}
            stroke="#616161"
            strokeWidth="2"
          />

          <line
            x1={upperX}
            x2={upperX}
            y1={intervalY - 12}
            y2={intervalY + 12}
            stroke="#616161"
            strokeWidth="2"
          />

          <circle
            cx={liftX}
            cy={intervalY}
            r="8"
            fill="#303030"
          />

          <text
            x={liftX}
            y={intervalY - 18}
            textAnchor="middle"
            fontSize="12"
            fontWeight="650"
            fill="#303030"
          >
            Observed {formatPercentagePoints(
              absoluteLift,
            )}
          </text>

          <line
            x1={left}
            x2={chartWidth - right}
            y1={axisY}
            y2={axisY}
            stroke="#b8b8b8"
            strokeWidth="1"
          />

          {ticks.map((tick) => {
            const x = scaleX(tick);

            return (
              <g key={tick}>
                <line
                  x1={x}
                  x2={x}
                  y1={axisY}
                  y2={axisY + 6}
                  stroke="#b8b8b8"
                  strokeWidth="1"
                />

                <text
                  x={x}
                  y={axisY + 22}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#616161"
                >
                  {(tick * 100).toFixed(1)} pp
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div
        style={{
          marginTop: "6px",
          paddingTop: "14px",
          borderTop: "1px solid #eeeeee",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "#616161",
            marginBottom: "4px",
          }}
        >
          Recommended action
        </div>

        <div
          style={{
            fontSize: "13px",
            lineHeight: 1.55,
            fontWeight: 600,
          }}
        >
          {getRecommendation({
            outcome,
            hasCriticalValidityIssue,
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e2e2",
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#616161",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "15px",
          fontWeight: 650,
          lineHeight: 1.35,
        }}
      >
        {value}
      </div>
    </div>
  );
}
