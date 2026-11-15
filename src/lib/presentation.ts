import { t as translate } from "./i18n";
import { day, minor } from "./accounting";
import type { Ledger, Transaction } from "./types";

export function cashMovement(transactions: Transaction[]) {
  let cashIn = 0,
    cashOut = 0,
    cashExpenses = 0,
    memberPurchases = 0;
  for (const t of transactions) {
    if (t.voided_at) continue;
    const amount = minor(t.amount);
    if (t.type === "contribution" || t.type === "loan_received")
      cashIn += amount;
    if (t.type === "loan_repayment") cashOut += amount;
    if (t.type === "expense") {
      if (t.funding_source === "group_funds") {
        cashExpenses += amount;
        cashOut += amount;
      } else memberPurchases += amount;
    }
  }
  return { cashIn, cashOut, cashExpenses, memberPurchases };
}
export function memberCashPaid(data: Ledger, memberId: string) {
  return cashMovement(data.transactions.filter((t) => t.member_id === memberId))
    .cashIn;
}
export function transactionLabel(t: Transaction) {
  if (t.type === "contribution") return translate("Fee payment");
  if (t.type === "loan_received") return translate("Member lent money");
  if (t.type === "loan_repayment") return translate("Club repaid member");
  return t.funding_source === "member_personal"
    ? translate("Member-funded expense")
    : translate("Cash expense");
}
export function isOriginalDateUnknown(t: Transaction) {
  const imported = t.notes?.match(/Opening ledger import (\d{4}-\d{2}-\d{2})/);
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t.transaction_date));
  return (
    !!imported &&
    /date unknown/i.test(t.notes || "") &&
    localDate === imported[1]
  );
}
export function transactionDateLabel(t: Transaction) {
  return isOriginalDateUnknown(t)
    ? translate("Original date unknown · imported {date}", {
        date: day(t.transaction_date),
      })
    : day(t.transaction_date);
}

// Reciprocal record IDs keep the two cash movements traceable without a schema change.
const linkPattern = /(?:^|\n)\[Linked transaction: ([0-9a-f-]{36})\]$/i;
export function withoutLink(notes: string | null | undefined) {
  return (notes || "").replace(linkPattern, "");
}
export function withLink(notes: string, id: string) {
  return `${withoutLink(notes)}\n[Linked transaction: ${id}]`;
}
export function linkedEntry(data: Ledger, transaction: Transaction) {
  const id = transaction.notes?.match(linkPattern)?.[1];
  return id ? data.transactions.find((row) => row.id === id) : undefined;
}
