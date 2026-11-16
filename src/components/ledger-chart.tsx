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
            stroke="var(--line)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-faint)", fontSize: 11 }}
            dy={9}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-faint)", fontSize: 10 }}
            tickFormatter={(v) => (v >= 1000 ? "৳" + v / 1000 + "k" : "৳" + v)}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              color: "var(--text)",
              borderRadius: 12,
            }}
            labelStyle={{ color: "var(--text-muted)" }}
            labelFormatter={(label, payload) =>
              payload?.[0]?.payload?.range || label
            }
            formatter={(v) => "৳" + Number(v).toLocaleString()}
          />
          <Bar
            dataKey={cash ? "CashIn" : "Contributions"}
            name={cash ? t("Cash received") : t("Fee payments (cash)")}
            fill="#14b8a6"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            dataKey={cash ? "CashOut" : "Expenses"}
            name={cash ? t("Cash spent / repaid") : t("Expenses")}
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
