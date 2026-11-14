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
  if (t.type === "contribution") return "Fee payment";
  if (t.type === "loan_received") return "Member lent money";
  if (t.type === "loan_repayment") return "Club repaid member";
  return t.funding_source === "member_personal"
    ? "Member-funded expense"
    : "Cash expense";
}
export function transactionDateLabel(t: Transaction) {
  const imported = t.notes?.match(/Opening ledger import (\d{4}-\d{2}-\d{2})/);
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t.transaction_date));
  return imported &&
    /date unknown/i.test(t.notes || "") &&
    localDate === imported[1]
    ? `Original date unknown · imported ${day(t.transaction_date)}`
    : day(t.transaction_date);
}
