import { t } from "../lib/i18n";
import { transactionDateLabel, transactionLabel } from "../lib/presentation";
import { labels } from "../lib/labels";
import { money, minor } from "../lib/accounting";
import { Empty } from "./ui-kit";
import type { Ledger, Transaction, Kind } from "../lib/types";
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  ChevronRight,
} from "lucide-react";

export const txIcons: Record<Kind, typeof ArrowDownLeft> = {
  contribution: ArrowDownLeft,
  expense: ArrowUpRight,
  loan_received: HandCoins,
  loan_repayment: ArrowUpRight,
};

export function paymentMethodLabel(method: string | null | undefined) {
  return t(
    {
      cash: "Cash",
      bank_transfer: "Bank transfer",
      mobile_wallet: "Mobile wallet",
      other: "Other",
    }[method || ""] || "",
  );
}

export function TxRow({
  ledger,
  tx,
  onOpen,
}: {
  ledger: Ledger;
  tx: Transaction;
  onOpen?: (tx: Transaction) => void;
}) {
  const Icon = txIcons[tx.type];
  const member = ledger.members.find(
    (m) => m.id === (tx.member_id || tx.paid_by_member_id),
  );
  const category = ledger.expense_categories.find(
    (c) => c.id === tx.category_id,
  );
  const amountClass =
    tx.voided_at || tx.funding_source === "member_personal"
      ? "tx-amount"
      : "tx-amount " +
        (tx.type === "contribution" || tx.type === "loan_received"
          ? "in"
          : "out");
  const sign =
    tx.voided_at || tx.funding_source === "member_personal"
      ? ""
      : tx.type === "contribution" || tx.type === "loan_received"
        ? "+"
        : "−";
  const detail = tx.voided_at
    ? t("Voided")
    : tx.funding_source === "member_personal"
      ? t(
          tx.personal_settlement === "contribution"
            ? "Fees credited · no cash moved"
            : "Loan added · no cash moved",
        )
      : paymentMethodLabel(tx.payment_method);
  const className = "tx-row" + (tx.voided_at ? " voided" : "");
  const body = (
    <>
      <span className={"tx-icon " + tx.type} aria-hidden="true">
        <Icon size={19} />
      </span>
      <span className="tx-main">
        <strong>{tx.description || t(labels[tx.type])}</strong>
        <small>
          <span className="tx-mobile-type">{transactionLabel(tx)} · </span>
          {member?.name || category?.name || t("Group funds")}
          {" · "}
          {transactionDateLabel(tx)}
        </small>
      </span>
      <span className={amountClass}>
        {sign}
        {money(minor(tx.amount))}
        <small>{detail}</small>
      </span>
      {onOpen ? <ChevronRight size={15} className="muted" /> : null}
    </>
  );
  if (onOpen)
    return (
      <button className={className} onClick={() => onOpen(tx)}>
        {body}
      </button>
    );
  return <div className={className}>{body}</div>;
}

export function TxList({
  ledger,
  rows,
  onOpen,
}: {
  ledger: Ledger;
  rows: Transaction[];
  onOpen?: (tx: Transaction) => void;
}) {
  if (!rows.length)
    return (
      <Empty
        title="No transactions yet"
        text="Your financial history starts with the first entry."
      />
    );
  return (
    <div className="tx-list">
      {rows.map((tx) => (
        <TxRow key={tx.id} ledger={ledger} tx={tx} onOpen={onOpen} />
      ))}
    </div>
  );
}

export function groupTransactionsByDate(rows: Transaction[]) {
  const groups: { key: string; date: string; rows: Transaction[] }[] = [];
  const sorted = [...rows].sort(
    (a, b) =>
      Date.parse(b.transaction_date) - Date.parse(a.transaction_date) ||
      Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  for (const tx of sorted) {
    const key = tx.transaction_date.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(tx);
    else groups.push({ key, date: tx.transaction_date, rows: [tx] });
  }
  return groups;
}
