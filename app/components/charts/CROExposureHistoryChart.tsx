import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type CROExposureHistoryItem = {
  date: string;
  control: number;
  treatment: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function ExposureTooltip({
  active,
  payload,
  label,
  controlLabel,
  treatmentLabel,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number | string;
  }>;
  label?: string;
  controlLabel: string;
  treatmentLabel: string;
}) {
  if (!active || !payload?.length || !label) {
    return null;
  }

  const control =
    payload.find(
      (item) =>
        item.dataKey === "control",
    )?.value ?? 0;

  const treatment =
    payload.find(
      (item) =>
        item.dataKey === "treatment",
    )?.value ?? 0;

  return (
    <div
      style={{
        minWidth: "190px",
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
          marginBottom: "8px",
        }}
      >
        {formatDate(label)}
      </div>

      <div
        style={{
          display: "grid",
          gap: "5px",
          fontSize: "13px",
        }}
      >
        <div>
          {controlLabel}:{" "}
          <strong>
            {Number(
              control,
            ).toLocaleString()}
          </strong>
        </div>

        <div>
          {treatmentLabel}:{" "}
          <strong>
            {Number(
              treatment,
            ).toLocaleString()}
          </strong>
        </div>
      </div>
    </div>
  );
}

export function CROExposureHistoryChart({
  data,
  controlLabel = "Control",
  treatmentLabel = "Treatment",
}: {
  data: CROExposureHistoryItem[];
  controlLabel?: string;
  treatmentLabel?: string;
}) {
  if (data.length === 0) {
    return null;
  }

  const maxVisitors = Math.max(
    ...data.flatMap((item) => [
      item.control,
      item.treatment,
    ]),
    0,
  );

  const yMax = Math.max(
    5,
    Math.ceil(maxVisitors * 1.15),
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
        <LineChart
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
            dataKey="date"
            tickFormatter={formatDate}
            tick={{
              fontSize: 12,
            }}
            axisLine={{
              stroke: "#b8b8b8",
            }}
            tickLine={false}
            minTickGap={28}
          />

          <YAxis
            domain={[0, yMax]}
            allowDecimals={false}
            tick={{
              fontSize: 12,
            }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            content={
              <ExposureTooltip
                controlLabel={
                  controlLabel
                }
                treatmentLabel={
                  treatmentLabel
                }
              />
            }
            allowEscapeViewBox={{
              x: true,
              y: true,
            }}
            wrapperStyle={{
              zIndex: 10,
            }}
          />

          <Legend
            verticalAlign="top"
            align="right"
            height={36}
            formatter={(value) =>
              value === "control"
                ? controlLabel
                : treatmentLabel
            }
          />

          <Line
            type="monotone"
            dataKey="control"
            stroke="#616161"
            strokeWidth={3}
            dot={{
              r: 3,
              fill: "#616161",
            }}
            activeDot={{
              r: 5,
            }}
          />

          <Line
            type="monotone"
            dataKey="treatment"
            stroke="#1473e6"
            strokeWidth={3}
            dot={{
              r: 3,
              fill: "#1473e6",
            }}
            activeDot={{
              r: 5,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
