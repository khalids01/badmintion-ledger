import { t } from "../lib/i18n";
import { money, minor, calculate, day } from "../lib/accounting";
import { weeklyActivity, type ActivityPoint } from "../lib/reporting";
import { TxList } from "../components/tx-list";
import { PanelTitle } from "../components/ui-kit";
import { LedgerChartLazy } from "./lazy-chart";
import type { LedgerWorkspace } from "./use-ledger";
import type { Transaction } from "../lib/types";
import { Download, CalendarDays } from "lucide-react";
import { useMemo } from "react";

export function ReportsPage({
  workspace,
  onExportTransactions,
  onExportMembers,
  onOpenTx,
}: {
  workspace: LedgerWorkspace;
  onExportTransactions?: () => void;
  onExportMembers?: () => void;
  onOpenTx?: (tx: Transaction) => void;
}) {
  const {
    data,
    totals,
    monthly,
    chartWeeks,
    setChartWeeks,
    from,
    setFrom,
    to,
    setTo,
    my,
    filtered,
  } = workspace;

  const weekly = useMemo(
    () => weeklyActivity(data, chartWeeks),
    [data, chartWeeks],
  );

  const categoryRows = useMemo(() => {
    const rows = data.expense_categories
      .map((c) => {
        const value = data.transactions
          .filter(
            (tx) =>
              !tx.voided_at &&
              tx.type === "expense" &&
              tx.category_id === c.id &&
              (!from || tx.transaction_date.slice(0, 10) >= from) &&
              (!to || tx.transaction_date.slice(0, 10) <= to),
          )
          .reduce((sum, tx) => sum + minor(tx.amount), 0);
        return { category: c, value };
      })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const max = Math.max(1, ...rows.map((r) => r.value));
    return rows.map((r) => ({ ...r, percent: (r.value / max) * 100 }));
  }, [data.expense_categories, data.transactions, from, to]);

  const memberCredit = useMemo(
    () =>
      data.members.map((m) => {
        const txs = filtered.filter(
          (t) =>
            !t.voided_at &&
            (t.member_id === m.id || t.paid_by_member_id === m.id),
        );
        const credit = calculate({
          ...data,
          transactions: txs,
          dues: [],
        }).members[m.id].credit;
        return { member: m, credit };
      }),
    [data, filtered],
  );

  const cashHistory = useMemo(() => {
    let running = 0;
    const rows = [...data.transactions]
      .filter((t) => !t.voided_at)
      .sort(
        (a, b) =>
          Date.parse(a.transaction_date) - Date.parse(b.transaction_date) ||
          Date.parse(a.created_at) - Date.parse(b.created_at),
      )
      .map((t) => {
        const effect = calculate({
          ...data,
          transactions: [t],
          dues: [],
        }).funds;
        running += effect;
        return { t, running, effect };
      })
      .filter(
        ({ t }) =>
          (!from || t.transaction_date.slice(0, 10) >= from) &&
          (!to || t.transaction_date.slice(0, 10) <= to),
      );
    return rows.reverse();
  }, [data, from, to]);

  return (
    <>
      <div className="report-toolbar">
        <div
          className="date-filters panel"
          style={{ padding: "8px 12px", borderRadius: 12 }}
        >
          <CalendarDays size={16} className="muted" />
          <input
            aria-label={t("From date")}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="muted">–</span>
          <input
            aria-label={t("To date")}
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {onExportTransactions && (
          <button className="button secondary" onClick={onExportTransactions}>
            <Download size={16} />
            {t("Export CSV")}
          </button>
        )}
        {onExportMembers && (
          <button className="button secondary" onClick={onExportMembers}>
            <Download size={16} />
            {t("Member balances CSV")}
          </button>
        )}
      </div>

      <div className="report-grid">
        <section className="panel span-2">
          <PanelTitle
            title="Monthly income versus expenses"
            subtitle="BDT · non-voided transactions"
          />
          <div className="chart-wrap">
            <LedgerChartLazy data={monthly} />
          </div>
        </section>

        <section className="panel">
          <PanelTitle
            title="Cash in, cash out"
            subtitle="Weekly cash received and spent · Monday–Sunday"
            right={
              <select
                className="chart-period"
                aria-label={t("Chart weeks")}
                value={chartWeeks}
                onChange={(e) => setChartWeeks(Number(e.target.value))}
              >
                {[2, 4, 8, 12].map((n) => (
                  <option key={n} value={n}>
                    {t("Last {count} weeks", { count: n })}
                  </option>
                ))}
              </select>
            }
          />
          <div className="chart-legend">
            <span>
              <i className="green-bg" />
              {t("Cash received (fees + loans)")}
            </span>
            <span>
              <i className="orange-bg" />
              {t("Cash spent / repaid")}
            </span>
          </div>
          <div className="chart-wrap">
            <LedgerChartLazy data={weekly as ActivityPoint[]} cash />
          </div>
        </section>

        <section className="panel">
          <PanelTitle
            title="Expenses by category"
            subtitle="All funding sources included"
          />
          {categoryRows.length ? (
            categoryRows.map(({ category, value, percent }) => (
              <div className="category-report" key={category.id}>
                <span>{category.name}</span>
                <strong>{money(value)}</strong>
                <div aria-hidden="true">
                  <i style={{ width: percent + "%" }} />
                </div>
              </div>
            ))
          ) : (
            <p className="chart-note">
              {t("No expenses recorded in this period.")}
            </p>
          )}
        </section>

        <section className="panel span-2">
          <PanelTitle
            title="Fee payments by member"
            subtitle="Cash and member-funded purchases counted toward fees · selected period"
          />
          {memberCredit.map(({ member, credit }) => (
            <div className="assigned-row" key={member.id}>
              <span>{member.name}</span>
              <strong>{money(credit)}</strong>
            </div>
          ))}
        </section>

        <section className="panel span-2">
          <PanelTitle
            title="Cash balance history"
            subtitle="Cash received minus cash spent / repaid · member-funded purchases excluded"
          />
          {cashHistory.length ? (
            cashHistory.map(({ t: tx, running, effect }) => (
              <div className="assigned-row" key={tx.id}>
                <span>
                  <strong>{tx.description || t(tx.type)}</strong>
                  <small>
                    {day(tx.transaction_date)} · {effect < 0 ? "−" : "+"}
                    {money(Math.abs(effect))}
                  </small>
                </span>
                <strong>{money(running)}</strong>
              </div>
            ))
          ) : (
            <p className="chart-note">
              {t("No cash movement in this period.")}
            </p>
          )}
        </section>

        <section className="panel span-2">
          <PanelTitle
            title="Money the club owes back"
            subtitle="Balances include all prior activity; date filters limit displayed transactions."
          />
          <div className="report-summary">
            <span>
              {t("Cash in hand")}
              <strong>{money(totals.funds)}</strong>
            </span>
            <span>
              {t("Club must repay")}
              <strong>{money(totals.loans)}</strong>
            </span>
            {my && (
              <span>
                {t("Club owes you")}
                <strong>{money(totals.members[my.id].loans)}</strong>
              </span>
            )}
          </div>
          <TxList ledger={data} rows={filtered} onOpen={onOpenTx} />
        </section>
      </div>
    </>
  );
}
