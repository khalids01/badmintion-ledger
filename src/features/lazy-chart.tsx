import { lazy, Suspense } from "react";
import { t } from "../lib/i18n";
import type { ActivityPoint } from "../lib/reporting";

const Lazy = lazy(() => import("../components/ledger-chart"));

export function LedgerChartLazy({
  data,
  cash = false,
}: {
  data: ActivityPoint[];
  cash?: boolean;
}) {
  return (
    <Suspense
      fallback={<div className="chart-loading">{t("Loading chart…")}</div>}
    >
      <Lazy data={data} cash={cash} />
    </Suspense>
  );
}
