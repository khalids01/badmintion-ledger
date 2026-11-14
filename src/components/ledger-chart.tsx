import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
export default function LedgerChart({
  data,
}: {
  data: { month: string; Contributions: number; Expenses: number }[];
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barGap={5}
          margin={{ top: 16, right: 10, left: -14, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#eef0f2"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#92949e", fontSize: 11 }}
            dy={9}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#92949e", fontSize: 10 }}
            tickFormatter={(v) => (v >= 1000 ? "৳" + v / 1000 + "k" : "৳" + v)}
          />
          <Tooltip
            cursor={{ fill: "#f6f7f8" }}
            formatter={(v) => "৳" + Number(v).toLocaleString()}
          />
          <Bar
            dataKey="Contributions"
            fill="#43a894"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            dataKey="Expenses"
            fill="#efb88c"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
