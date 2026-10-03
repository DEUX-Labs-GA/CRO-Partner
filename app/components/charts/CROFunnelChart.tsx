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

export type CROFunnelChartItem = {
  label: string;
  visitors: number;
  rateFromProductView?: number | null;
};

function formatPercent(
  value: number | null | undefined,
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function FunnelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: CROFunnelChartItem;
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
        minWidth: "170px",
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
          Visitors:{" "}
          <strong>
            {item.visitors.toLocaleString()}
          </strong>
        </div>

        <div>
          From product view:{" "}
          <strong>
            {formatPercent(
              item.rateFromProductView,
            )}
          </strong>
        </div>
      </div>
    </div>
  );
}

function FunnelValueLabel({
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
      x={numericX + numericWidth + 8}
      y={numericY + numericHeight / 2}
      dy="0.35em"
      fontSize="12"
      fontWeight="600"
      fill="currentColor"
    >
      {Number(value ?? 0).toLocaleString()}
    </text>
  );
}

export function CROFunnelChart({
  data,
}: {
  data: CROFunnelChartItem[];
}) {
  const maxVisitors = Math.max(
    ...data.map((item) => item.visitors),
    0,
  );

  return (
    <div
      style={{
        width: "100%",
        minHeight: "340px",
        marginTop: "12px",
      }}
    >
      <ResponsiveContainer
        width="100%"
        height={340}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 8,
            right: 56,
            bottom: 8,
            left: 18,
          }}
          barCategoryGap="24%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#e6e6e6"
          />

          <XAxis
            type="number"
            allowDecimals={false}
            domain={[
              0,
              maxVisitors > 0
                ? Math.ceil(maxVisitors * 1.18)
                : 1,
            ]}
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
            width={140}
            tick={{
              fontSize: 13,
              fontWeight: 500,
            }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            content={<FunnelTooltip />}
            cursor={{
              fill: "rgba(0, 0, 0, 0.035)",
            }}
          />

          <Bar
            dataKey="visitors"
            fill="#303030"
            radius={[0, 7, 7, 0]}
            maxBarSize={48}
          >
            <LabelList
              dataKey="visitors"
              content={<FunnelValueLabel />}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
