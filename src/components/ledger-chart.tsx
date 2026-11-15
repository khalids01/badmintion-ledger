import { t } from "../lib/i18n";
import type { ActivityPoint } from "../lib/reporting";
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
  cash = false,
}: {
  data: ActivityPoint[];
  cash?: boolean;
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
            stroke="var(--line-e2e5e9, #eef0f2)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="label"
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
            cursor={{ fill: "var(--bg-f7f8fa, #f6f7f8)" }}
            contentStyle={{
              background: "var(--bg-ffffff, #fff)",
              border: "1px solid var(--line-e2e5e9, #e2e5e9)",
              color: "var(--text-292d35, #292d35)",
              borderRadius: 10,
            }}
            labelStyle={{ color: "var(--text-292d35, #292d35)" }}
            labelFormatter={(label, payload) =>
              payload?.[0]?.payload?.range || label
            }
            formatter={(v) => "৳" + Number(v).toLocaleString()}
          />
          <Bar
            dataKey={cash ? "CashIn" : "Contributions"}
            name={cash ? t("Cash received") : t("Fee payments (cash)")}
            fill="#43a894"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            dataKey={cash ? "CashOut" : "Expenses"}
            name={cash ? t("Cash spent / repaid") : t("Expenses")}
            fill="#efb88c"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
