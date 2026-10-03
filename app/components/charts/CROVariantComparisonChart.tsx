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

export type CROVariantComparisonItem = {
  label: string;
  conversionRate: number;
  visitors: number;
  conversions: number;
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function VariantTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: CROVariantComparisonItem;
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
        minWidth: "180px",
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
          Conversion rate:{" "}
          <strong>
            {formatPercent(
              item.conversionRate,
            )}
          </strong>
        </div>

        <div>
          Visitors:{" "}
          <strong>
            {item.visitors.toLocaleString()}
          </strong>
        </div>

        <div>
          Purchases:{" "}
          <strong>
            {item.conversions.toLocaleString()}
          </strong>
        </div>
      </div>
    </div>
  );
}

function PercentLabel({
  x,
  y,
  width,
  value,
}: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number;
}) {
  const numericX = Number(x ?? 0);
  const numericY = Number(y ?? 0);
  const numericWidth = Number(width ?? 0);

  return (
    <text
      x={numericX + numericWidth / 2}
      y={numericY - 8}
      textAnchor="middle"
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

export function CROVariantComparisonChart({
  data,
}: {
  data: CROVariantComparisonItem[];
}) {
  const maxRate = Math.max(
    ...data.map(
      (item) => item.conversionRate,
    ),
    0,
  );

  const yMax =
    maxRate > 0
      ? Math.min(
          1,
          Math.max(
            0.1,
            Math.ceil(
              maxRate * 120,
            ) / 100,
          ),
        )
      : 0.1;

  return (
    <div
      style={{
        width: "100%",
        minHeight: "320px",
        marginTop: "12px",
      }}
    >
      <ResponsiveContainer
        width="100%"
        height={320}
      >
        <BarChart
          data={data}
          margin={{
            top: 28,
            right: 24,
            bottom: 8,
            left: 8,
          }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e6e6e6"
          />

          <XAxis
            dataKey="label"
            tick={{
              fontSize: 13,
              fontWeight: 500,
            }}
            axisLine={{
              stroke: "#b8b8b8",
            }}
            tickLine={false}
          />

          <YAxis
            domain={[0, yMax]}
            tickFormatter={(value) =>
              `${Math.round(
                Number(value) * 100,
              )}%`
            }
            tick={{
              fontSize: 12,
            }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            content={<VariantTooltip />}
            allowEscapeViewBox={{
              x: true,
              y: true,
            }}
            wrapperStyle={{
              zIndex: 10,
            }}
            cursor={{
              fill: "rgba(0, 0, 0, 0.035)",
            }}
          />

          <Bar
            dataKey="conversionRate"
            fill="#303030"
            radius={[7, 7, 0, 0]}
            maxBarSize={120}
          >
            <LabelList
              dataKey="conversionRate"
              content={<PercentLabel />}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
