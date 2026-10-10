import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MINIMUM_SAMPLE_PER_VARIANT = 30;

type DistributionPoint = {
  rate: number;
  control: number;
  treatment: number;
};

function normalDensity(
  value: number,
  mean: number,
  standardError: number,
) {
  if (standardError <= 0) {
    return 0;
  }

  const z =
    (value - mean) /
    standardError;

  return (
    Math.exp(-0.5 * z * z) /
    (standardError *
      Math.sqrt(2 * Math.PI))
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function DistributionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number | string;
  }>;
  label?: number;
}) {
  if (
    !active ||
    !payload?.length ||
    typeof label !== "number"
  ) {
    return null;
  }

  return (
    <div
      style={{
        border: "1px solid #dcdcdc",
        borderRadius: "10px",
        background: "#ffffff",
        padding: "10px 12px",
        boxShadow:
          "0 4px 14px rgba(0, 0, 0, 0.08)",
        fontSize: "13px",
      }}
    >
      <div
        style={{
          fontWeight: 650,
        }}
      >
        Conversion rate{" "}
        {formatPercent(label)}
      </div>
    </div>
  );
}

export function CROStatisticalDistributionChart({
  controlVisitors,
  controlConversions,
  treatmentVisitors,
  treatmentConversions,
  controlLabel = "Control",
  treatmentLabel = "Treatment",
}: {
  controlVisitors: number;
  controlConversions: number;
  treatmentVisitors: number;
  treatmentConversions: number;
  controlLabel?: string;
  treatmentLabel?: string;
}) {
  const enoughData =
    controlVisitors >=
      MINIMUM_SAMPLE_PER_VARIANT &&
    treatmentVisitors >=
      MINIMUM_SAMPLE_PER_VARIANT;

  if (!enoughData) {
    const controlRemaining = Math.max(
      0,
      MINIMUM_SAMPLE_PER_VARIANT -
        controlVisitors,
    );

    const treatmentRemaining = Math.max(
      0,
      MINIMUM_SAMPLE_PER_VARIANT -
        treatmentVisitors,
    );

    return (
      <div
        style={{
          border: "1px solid #e2e2e2",
          borderRadius: "12px",
          padding: "16px",
          background: "#ffffff",
          marginTop: "12px",
        }}
      >
        <div
          style={{
            fontWeight: 650,
            marginBottom: "6px",
          }}
        >
          Distribution view not ready yet
        </div>

        <div
          style={{
            fontSize: "13px",
            lineHeight: 1.5,
            color: "#616161",
          }}
        >
          This visualization becomes available
          after both variants have at least{" "}
          {MINIMUM_SAMPLE_PER_VARIANT} exposed
          visitors. That prevents small samples
          from creating an overly precise-looking
          statistical story.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginTop: "14px",
          }}
        >
          <ProgressNote
            label={controlLabel}
            visitors={controlVisitors}
            remaining={controlRemaining}
          />

          <ProgressNote
            label={treatmentLabel}
            visitors={treatmentVisitors}
            remaining={treatmentRemaining}
          />
        </div>
      </div>
    );
  }

  const controlRate =
    controlConversions /
    controlVisitors;

  const treatmentRate =
    treatmentConversions /
    treatmentVisitors;

  const controlStandardError =
    Math.sqrt(
      (controlRate *
        (1 - controlRate)) /
        controlVisitors,
    );

  const treatmentStandardError =
    Math.sqrt(
      (treatmentRate *
        (1 - treatmentRate)) /
        treatmentVisitors,
    );

  if (
    controlStandardError <= 0 ||
    treatmentStandardError <= 0
  ) {
    return (
      <div
        style={{
          border: "1px solid #e2e2e2",
          borderRadius: "12px",
          padding: "16px",
          background: "#ffffff",
          marginTop: "12px",
          fontSize: "13px",
          lineHeight: 1.5,
          color: "#616161",
        }}
      >
        The distribution view is not available
        for this result because one variant has
        no observed variability yet.
      </div>
    );
  }

  const rawMin = Math.max(
    0,
    Math.min(
      controlRate -
        4 * controlStandardError,
      treatmentRate -
        4 * treatmentStandardError,
    ),
  );

  const rawMax = Math.min(
    1,
    Math.max(
      controlRate +
        4 * controlStandardError,
      treatmentRate +
        4 * treatmentStandardError,
    ),
  );

  const range =
    Math.max(rawMax - rawMin, 0.01);

  const points = 120;

  const data: DistributionPoint[] =
    Array.from(
      { length: points + 1 },
      (_, index) => {
        const rate =
          rawMin +
          (range * index) /
            points;

        return {
          rate,
          control: normalDensity(
            rate,
            controlRate,
            controlStandardError,
          ),
          treatment: normalDensity(
            rate,
            treatmentRate,
            treatmentStandardError,
          ),
        };
      },
    );

  return (
    <div
      style={{
        width: "100%",
        minHeight: "360px",
        marginTop: "12px",
      }}
    >
      <ResponsiveContainer
        width="100%"
        height={360}
      >
        <AreaChart
          data={data}
          margin={{
            top: 16,
            right: 28,
            bottom: 8,
            left: 8,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e6e6e6"
          />

          <XAxis
            dataKey="rate"
            type="number"
            domain={[rawMin, rawMax]}
            tickFormatter={formatPercent}
            tick={{
              fontSize: 12,
            }}
            axisLine={{
              stroke: "#b8b8b8",
            }}
            tickLine={false}
          />

          <YAxis
            hide
          />

          <Tooltip
            content={
              <DistributionTooltip />
            }
            allowEscapeViewBox={{
              x: false,
              y: true,
            }}
            wrapperStyle={{
              zIndex: 10,
            }}
          />

          <Area
            type="monotone"
            dataKey="control"
            name={controlLabel}
            stroke="#616161"
            fill="#d9d9d9"
            fillOpacity={0.45}
            strokeWidth={2}
          />

          <Area
            type="monotone"
            dataKey="treatment"
            name={treatmentLabel}
            stroke="#1473e6"
            fill="#1473e6"
            fillOpacity={0.18}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "18px",
          marginTop: "4px",
          fontSize: "12px",
          color: "#616161",
        }}
      >
        <span>
          <strong>{controlLabel}:</strong>{" "}
          {formatPercent(controlRate)}
        </span>

        <span>
          <strong>{treatmentLabel}:</strong>{" "}
          {formatPercent(
            treatmentRate,
          )}
        </span>
      </div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "12px",
          lineHeight: 1.5,
          color: "#616161",
        }}
      >
        These curves are normal-approximation
        sampling distributions based on the
        observed conversion rates and current
        sample sizes. Greater overlap means more
        uncertainty about which variant is truly
        better.
      </div>
    </div>
  );
}

function ProgressNote({
  label,
  visitors,
  remaining,
}: {
  label: string;
  visitors: number;
  remaining: number;
}) {
  return (
    <div
      style={{
        border: "1px solid #eeeeee",
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontWeight: 650,
          marginBottom: "4px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "13px",
          color: "#616161",
        }}
      >
        {visitors.toLocaleString()} exposed ·{" "}
        {remaining.toLocaleString()} remaining
        to unlock this view
      </div>
    </div>
  );
}
