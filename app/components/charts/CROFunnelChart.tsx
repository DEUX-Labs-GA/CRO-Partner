import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type CROFunnelChartItem = {
  label: string;
  visitors: number;
};

export function CROFunnelChart({
  data,
}: {
  data: CROFunnelChartItem[];
}) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "320px",
      }}
    >
      <ResponsiveContainer
        width="100%"
        height={320}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 8,
            right: 24,
            bottom: 8,
            left: 24,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
          />

          <XAxis
            type="number"
            allowDecimals={false}
          />

          <YAxis
            type="category"
            dataKey="label"
            width={130}
          />

          <Tooltip
            formatter={(value) => [
              Number(value).toLocaleString(),
              "Visitors",
            ]}
          />

          <Bar
            dataKey="visitors"
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
