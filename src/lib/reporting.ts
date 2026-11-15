import { getLanguage } from "./i18n";
import { calculate, day, today } from "./accounting";
import { cashMovement } from "./presentation";
import type { Ledger } from "./types";
export interface ActivityPoint {
  label: string;
  Contributions: number;
  Expenses: number;
  range?: string;
  CashIn?: number;
  CashOut?: number;
}
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function dhakaDate(value: string) {
  return dateFormatter.format(new Date(value));
}
export function weeklyActivity(
  data: Ledger,
  weeks = 2,
  through = today(),
): ActivityPoint[] {
  const monday = new Date(through + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const dated = data.transactions.map((transaction) => ({
    transaction,
    date: dhakaDate(transaction.transaction_date),
  }));
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(monday);
    start.setUTCDate(start.getUTCDate() - (weeks - 1 - i) * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const from = start.toISOString().slice(0, 10),
      to = end.toISOString().slice(0, 10);
    const transactions = dated
      .filter((row) => row.date >= from && row.date <= to)
      .map((row) => row.transaction);
    const totals = calculate({ ...data, transactions, dues: [] });
    const cash = cashMovement(transactions);
    return {
      CashIn: cash.cashIn / 100,
      CashOut: cash.cashOut / 100,
      label: new Intl.DateTimeFormat(
        getLanguage() === "bn" ? "bn-BD" : "en-GB",
        {
          timeZone: "UTC",
          day: "numeric",
          month: "short",
        },
      ).format(start),
      range:
        day(from + "T12:00:00+06:00") + " – " + day(to + "T12:00:00+06:00"),
      Contributions: totals.collected / 100,
      Expenses: totals.expenses / 100,
    };
  });
}
