import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type CROFeasibilityChartProps = {
  requiredSample: number;
  visitorsPerDay: number;
  recommendedDurationDays: number;
  estimatedDurationDays: number;
};

type FeasibilityChartItem = {
  label: string;
  percentage: number;
  availableVisitors: number;
  requiredSample: number;
};

function formatPercent(value: number) {
  if (value < 0.01) {
    return `${(value * 100).toFixed(2)}%`;
  }

  return `${(value * 100).toFixed(1)}%`;
}

function FeasibilityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: FeasibilityChartItem;
  }>;
}) {
  if (
    !active ||
    !payload?.length ||
    !payload[0]?.payload
  ) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div
      style={{
        minWidth: "210px",
        border: "1px solid #dcdcdc",
        borderRadius: "10px",
        background: "#ffffff",
        padding: "10px 12px",
        boxShadow:
          "0 4px 14px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div
        style={{
          fontWeight: 650,
          marginBottom: "6px",
        }}
      >
        {item.label}
      </div>

      <div
        style={{
          display: "grid",
          gap: "4px",
          fontSize: "13px",
        }}
      >
        <div>
          Sample available:{" "}
          <strong>
            {Math.round(
              item.availableVisitors,
            ).toLocaleString()}
          </strong>
        </div>

        <div>
          Sample required:{" "}
          <strong>
            {item.requiredSample.toLocaleString()}
          </strong>
        </div>

        <div>
          Requirement covered:{" "}
          <strong>
            {formatPercent(
              item.percentage,
            )}
          </strong>
        </div>
      </div>
    </div>
  );
}

function PercentageLabel({
  x,
  y,
  width,
  height,
  value,
}: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number;
}) {
  const numericX = Number(x ?? 0);
  const numericY = Number(y ?? 0);
  const numericWidth = Number(width ?? 0);
  const numericHeight = Number(height ?? 0);

  return (
    <text
      x={numericX + numericWidth + 10}
      y={numericY + numericHeight / 2}
      dy="0.35em"
      fontSize="12"
      fontWeight="600"
      fill="currentColor"
    >
      {formatPercent(
        Number(value ?? 0),
      )}
    </text>
  );
}

export function CROFeasibilityChart({
  requiredSample,
  visitorsPerDay,
  recommendedDurationDays,
  estimatedDurationDays,
}: CROFeasibilityChartProps) {
  const availableVisitors =
    visitorsPerDay *
    recommendedDurationDays;

  const percentage =
    requiredSample > 0
      ? Math.min(
          availableVisitors /
            requiredSample,
          1,
        )
      : 0;

  const data: FeasibilityChartItem[] = [
    {
      label: `${recommendedDurationDays}-day traffic capacity`,
      percentage,
      availableVisitors,
      requiredSample,
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        marginTop: "12px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            border:
              "1px solid #dcdcdc",
            borderRadius: "10px",
            padding: "14px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#616161",
              marginBottom: "4px",
            }}
          >
            Required sample
          </div>

          <div
            style={{
              fontSize: "20px",
              fontWeight: 650,
            }}
          >
            {requiredSample.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            border:
              "1px solid #dcdcdc",
            borderRadius: "10px",
            padding: "14px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#616161",
              marginBottom: "4px",
            }}
          >
            Traffic available in{" "}
            {recommendedDurationDays} days
          </div>

          <div
            style={{
              fontSize: "20px",
              fontWeight: 650,
            }}
          >
            {Math.round(
              availableVisitors,
            ).toLocaleString()}
          </div>
        </div>

        <div
          style={{
            border:
              "1px solid #dcdcdc",
            borderRadius: "10px",
            padding: "14px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#616161",
              marginBottom: "4px",
            }}
          >
            Estimated duration
          </div>

          <div
            style={{
              fontSize: "20px",
              fontWeight: 650,
            }}
          >
            {estimatedDurationDays.toLocaleString()} days
          </div>
        </div>
      </div>

      <div
        style={{
          minHeight: "190px",
        }}
      >
        <ResponsiveContainer
          width="100%"
          height={190}
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{
              top: 10,
              right: 70,
              bottom: 10,
              left: 10,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#e6e6e6"
            />

            <XAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(value) =>
                `${Math.round(
                  Number(value) * 100,
                )}%`
              }
              tick={{
                fontSize: 12,
              }}
              axisLine={{
                stroke: "#b8b8b8",
              }}
              tickLine={false}
            />

            <YAxis
              type="category"
              dataKey="label"
              width={170}
              tick={{
                fontSize: 13,
                fontWeight: 500,
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              content={
                <FeasibilityTooltip />
              }
              allowEscapeViewBox={{
                x: true,
                y: true,
              }}
              wrapperStyle={{
                zIndex: 10,
              }}
              cursor={{
                fill:
                  "rgba(0, 0, 0, 0.035)",
              }}
            />

            <Bar
              dataKey="percentage"
              fill="#303030"
              radius={[0, 7, 7, 0]}
              maxBarSize={42}
            >
              <LabelList
                dataKey="percentage"
                content={
                  <PercentageLabel />
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
