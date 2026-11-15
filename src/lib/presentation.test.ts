import { describe, it, expect } from "vitest";
import {
  cashMovement,
  isOriginalDateUnknown,
  memberCashPaid,
  transactionDateLabel,
} from "./presentation";
import { weeklyActivity } from "./reporting";
import { demo } from "../test/ledger-fixture";
import type { Transaction } from "./types";
const row = (values: Partial<Transaction>): Transaction => ({
  ...demo.transactions[0],
  amount: 100,
  transaction_date: "2026-11-15T12:00:00+06:00",
  ...values,
});
describe("plain-language money presentation", () => {
  it("separates loan receipts, repayments and member-funded items from cash spending", () => {
    const rows = [
      row({ type: "contribution", amount: 100 }),
      row({ type: "loan_received", amount: 300 }),
      row({ type: "loan_repayment", amount: 50 }),
      row({ type: "expense", amount: 200, funding_source: "group_funds" }),
      row({ type: "expense", amount: 600, funding_source: "member_personal" }),
      row({ type: "contribution", amount: 999, voided_at: "2026-11-15" }),
    ];
    expect(cashMovement(rows)).toEqual({
      cashIn: 40000,
      cashOut: 25000,
      cashExpenses: 20000,
      memberPurchases: 60000,
    });
    const data = { ...demo, transactions: rows };
    expect(memberCashPaid(data, "m0")).toBe(40000);
    const weeks = weeklyActivity(data, 2, "2026-11-15");
    expect(weeks[1].CashIn).toBe(400);
    expect(weeks[1].CashOut).toBe(250);
  });
  it("defaults to exactly two weekly periods", () => {
    expect(weeklyActivity(demo)).toHaveLength(2);
  });
  it("makes unknown imported dates explicit, but shows a date corrected by the user", () => {
    const imported = row({
      notes:
        "Opening ledger import 2026-11-15. Original payment/purchase date unknown; import date used.",
    });
    expect(isOriginalDateUnknown(imported)).toBe(true);
    expect(
      isOriginalDateUnknown({
        ...imported,
        transaction_date: "2026-11-10T12:00:00+06:00",
      }),
    ).toBe(false);
    expect(transactionDateLabel(imported)).toContain("Original date unknown");
    expect(
      transactionDateLabel({
        ...imported,
        transaction_date: "2026-11-10T12:00:00+06:00",
      }),
    ).toBe("10 Nov 2026");
  });
});
