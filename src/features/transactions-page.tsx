import { t } from "../lib/i18n";
import { labels } from "../lib/labels";
import { TxRow } from "../components/tx-list";
import { Empty } from "../components/ui-kit";
import { day } from "../lib/accounting";
import { groupTransactionsByDate } from "../components/tx-list";
import type { LedgerWorkspace } from "./use-ledger";
import type { Transaction } from "../lib/types";
import { Search, SlidersHorizontal, Download } from "lucide-react";

export function TransactionsPage({
  workspace,
  readOnly,
  onOpenTx,
  onExport,
}: {
  workspace: LedgerWorkspace;
  readOnly?: boolean;
  onOpenTx?: (tx: Transaction) => void;
  onExport?: () => void;
}) {
  const {
    data,
    filtered,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    memberFilter,
    setMemberFilter,
    categoryFilter,
    setCategoryFilter,
    from,
    setFrom,
    to,
    setTo,
    advanced,
    setAdvanced,
  } = workspace;

  const groups = groupTransactionsByDate(filtered);

  return (
    <section className="panel">
      <div className="filters">
        <label className="search">
          <Search size={18} />
          <input
            placeholder={t("Search transactions…")}
            aria-label={t("Search transactions…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label={t("Transaction type")}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">{t("All transactions")}</option>
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v)}
            </option>
          ))}
        </select>
        <button
          className="filter-toggle"
          aria-expanded={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          <SlidersHorizontal size={16} />
          {t("Filters")}
        </button>
        {onExport && (
          <button className="filter-toggle" onClick={onExport}>
            <Download size={16} />
            {t("Export CSV")}
          </button>
        )}
        {advanced && (
          <div className="advanced-filters">
            <select
              aria-label={t("Member filter")}
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
            >
              <option value="">{t("All members")}</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t("Category filter")}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">{t("All categories")}</option>
              {data.expense_categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="date-filters">
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
          </div>
        )}
      </div>

      <div className="chip-row">
        {[
          ["all", t("All transactions")],
          ["contribution", t("Fee payment")],
          ["expense", t("Purchase / expense")],
          ["loan_received", t("Member lent money to club")],
          ["loan_repayment", t("Club repaid a member")],
        ].map(([key, label]) => (
          <button
            key={key}
            className={"chip" + (typeFilter === key ? " active" : "")}
            onClick={() => setTypeFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {groups.length ? (
        groups.map((group) => (
          <div className="tx-group" key={group.key}>
            <div className="tx-group-header">{day(group.date)}</div>
            {group.rows.map((tx) => (
              <TxRow key={tx.id} ledger={data} tx={tx} onOpen={onOpenTx} />
            ))}
          </div>
        ))
      ) : (
        <Empty
          title="No transactions yet"
          text="Your financial history starts with the first entry."
        />
      )}
      {readOnly && (
        <p className="form-hint" style={{ padding: "12px 18px" }}>
          {t("Only the administrator can edit or void transactions.")}
        </p>
      )}
    </section>
  );
}
