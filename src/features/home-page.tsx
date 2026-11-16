import { t } from "../lib/i18n";
import { money } from "../lib/accounting";
import { TxList } from "../components/tx-list";
import { Avatar, PanelTitle, Empty } from "../components/ui-kit";
import type { LedgerWorkspace } from "./use-ledger";
import {
  Wallet,
  Users,
  HandCoins,
  Receipt,
  ArrowRight,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

export function HomePage({
  workspace,
  readOnly,
  onOpenCash,
  onOpenLoans,
  onOpenMember,
  onRecordPayment,
  onOpenAddExpense,
  onOpenTx,
}: {
  workspace: LedgerWorkspace;
  readOnly?: boolean;
  onOpenCash: () => void;
  onOpenLoans: () => void;
  onOpenMember: (member: import("../lib/types").Member) => void;
  onRecordPayment: () => void;
  onOpenAddExpense: () => void;
  onOpenTx: (tx: import("../lib/types").Transaction) => void;
}) {
  const { data, totals, pending, recent, my } = workspace;
  const myBalance = my ? totals.members[my.id] : undefined;
  return (
    <div className="home-grid">
      <div className="home-col">
        {/* Cash hero */}
        <button
          className="hero"
          onClick={onOpenCash}
          aria-label={t("Cash in hand")}
        >
          <small>
            <Wallet size={14} />
            {t("Cash in hand")}
          </small>
          <div className="hero-value">{money(totals.funds)}</div>
          <div className="hero-foot">
            <span>
              {t("Actual cash available. Not total contributions or dues.")}
            </span>
            {!readOnly && <ChevronRight size={17} />}
          </div>
        </button>

        {/* Compact dues / expenses cards */}
        <div className="stat-duo">
          <button
            className="stat-tile warn"
            onClick={() => workspace.go("Members", { memberTab: "dues" })}
          >
            <span className="stat-label">
              <Users size={16} />
              {t("Members still owe")}
            </span>
            <span className="stat-value">{money(totals.outstanding)}</span>
            <span className="stat-foot">
              {t("{count} members", { count: pending.length })}
              <ChevronRight size={13} />
            </span>
          </button>
          <button
            className="stat-tile"
            onClick={() => workspace.go("Transactions")}
          >
            <span className="stat-label">
              <Receipt size={16} />
              {t("Total spent")}
            </span>
            <span className="stat-value">{money(totals.expenses)}</span>
            <span className="stat-foot">
              {t("All spending")}
              <ChevronRight size={13} />
            </span>
          </button>
        </div>

        {/* Visible club-debt indication */}
        {totals.loans > 0 && (
          <button className="debt-banner" onClick={onOpenLoans}>
            <HandCoins size={22} />
            <span>
              <strong>
                {t("Club must repay {amount}", { amount: money(totals.loans) })}
              </strong>
              <small>
                {t(
                  readOnly
                    ? "Member loans"
                    : "Borrowed from members. Repay through Add → Borrow or repay.",
                )}
              </small>
            </span>
            {!readOnly && <ChevronRight size={18} />}
          </button>
        )}

        {/* Two admin quick actions */}
        {!readOnly && (
          <div className="quick-grid">
            <button className="quick-action collect" onClick={onRecordPayment}>
              <span className="qa-icon" aria-hidden="true">
                <ArrowDownLeft size={20} />
              </span>
              <span>
                {t("Collect money")}
                <small>{t("Record a member payment")}</small>
              </span>
            </button>
            <button className="quick-action expense" onClick={onOpenAddExpense}>
              <span className="qa-icon" aria-hidden="true">
                <ArrowUpRight size={20} />
              </span>
              <span>
                {t("Add expense")}
                <small>{t("Club bought something")}</small>
              </span>
            </button>
          </div>
        )}

        {/* Few outstanding members */}
        <section className="panel">
          <PanelTitle
            title="Who still needs to pay"
            subtitle="Unpaid entry and weekly fees. Loans are separate."
            right={
              <button
                className="text-button"
                onClick={() => workspace.go("Members", { memberTab: "dues" })}
              >
                {t("View all")}
                <ArrowRight size={14} />
              </button>
            }
          />
          {pending.length ? (
            pending.slice(0, 4).map((m, i) => (
              <button
                className="due-row balance-row"
                key={m.id}
                onClick={() => onOpenMember(m)}
              >
                <Avatar name={m.name} index={i} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{m.name}</strong>
                  <small>
                    {Math.round(
                      (workspace.totals.members[m.id].credit /
                        Math.max(1, workspace.totals.members[m.id].assigned)) *
                        100,
                    )}
                    {t("% paid")}
                  </small>
                </span>
                <strong style={{ color: "var(--amber)" }}>
                  {money(totals.members[m.id].outstanding)}
                </strong>
              </button>
            ))
          ) : (
            <Empty title="All caught up" text="No outstanding member dues." />
          )}
        </section>
      </div>

      <div className="home-col">
        {myBalance && my && (
          <section className="panel">
            <PanelTitle
              title="My balance"
              subtitle="Your fees and what the club owes you."
            />
            <div className="settings-body" style={{ paddingTop: 4 }}>
              <div className="statement-split">
                <div>
                  <span>{t("Still due")}</span>
                  <strong>{money(myBalance.outstanding)}</strong>
                </div>
                <div>
                  <span>{t("Club owes me")}</span>
                  <strong>{money(myBalance.loans)}</strong>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Recent transactions */}
        <section className="panel">
          <PanelTitle
            title="Recent transactions"
            subtitle="The latest from your ledger."
            right={
              <button
                className="text-button"
                onClick={() => workspace.go("Transactions")}
              >
                {t("View all")}
                <ArrowRight size={14} />
              </button>
            }
          />
          <TxList
            ledger={data}
            rows={recent}
            onOpen={workspace.query.isLoading ? undefined : onOpenTx}
          />
        </section>
      </div>

      {my && readOnly && myBalance && myBalance.loans > 0 && (
        <p className="form-hint" style={{ margin: "0 2px" }}>
          {t("Loan repayments are recorded by the administrator.")}
        </p>
      )}

      {!readOnly && myBalance && myBalance.loans > 0 && (
        <button className="debt-banner" onClick={onOpenLoans}>
          <HandCoins size={22} />
          <span>
            <strong>
              {t("The club owes you {amount}", {
                amount: money(myBalance.loans),
              })}
            </strong>
            <small>{t("Tap to see who is owed and record repayments.")}</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}
