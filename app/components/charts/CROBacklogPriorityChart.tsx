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

export type CROBacklogPriorityItem = {
  id: string;
  title: string;
  priorityScore: number;
  status: string;
  reach: number;
  impact: string;
  confidence: string;
  effort: number;
};

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(
      /(^|_)([a-z])/g,
      (_, prefix, letter) =>
        `${prefix ? " " : ""}${letter.toUpperCase()}`,
    );
}

function BacklogTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: CROBacklogPriorityItem;
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
        minWidth: "220px",
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
        {item.title}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: "16px",
          rowGap: "4px",
          fontSize: "13px",
        }}
      >
        <div>
          Priority score:{" "}
          <strong>
            {item.priorityScore.toFixed(1)}
          </strong>
        </div>

        <div>
          Status:{" "}
          <strong>
            {formatLabel(item.status)}
          </strong>
        </div>

        <div>
          Reach:{" "}
          <strong>
            {item.reach.toLocaleString()}
          </strong>
        </div>

        <div>
          Impact:{" "}
          <strong>
            {formatLabel(item.impact)}
          </strong>
        </div>

        <div>
          Confidence:{" "}
          <strong>
            {formatLabel(item.confidence)}
          </strong>
        </div>

        <div>
          Effort:{" "}
          <strong>
            {item.effort.toFixed(1)}
          </strong>
        </div>
      </div>
    </div>
  );
}

function PriorityLabel({
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
      {Number(value ?? 0).toFixed(1)}
    </text>
  );
}

export function CROBacklogPriorityChart({
  data,
}: {
  data: CROBacklogPriorityItem[];
}) {
  if (data.length === 0) {
    return null;
  }

  const maxScore = Math.max(
    ...data.map(
      (item) => item.priorityScore,
    ),
    0,
  );

  const chartHeight = Math.max(
    400,
    data.length * 78 + 120,
  );

  return (
    <div
      style={{
        width: "100%",
        marginTop: "12px",
      }}
    >
      <ResponsiveContainer
        width="100%"
        height={chartHeight}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 10,
            right: 64,
            bottom: 110,
            left: 24,
          }}
          barCategoryGap="22%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#e6e6e6"
          />

          <XAxis
            type="number"
            domain={[
              0,
              maxScore > 0
                ? Math.ceil(maxScore * 1.15)
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
            dataKey="title"
            width={180}
            tick={{
              fontSize: 13,
              fontWeight: 500,
            }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            content={<BacklogTooltip />}
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
            dataKey="priorityScore"
            fill="#303030"
            radius={[0, 7, 7, 0]}
            maxBarSize={42}
          >
            <LabelList
              dataKey="priorityScore"
              content={<PriorityLabel />}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
