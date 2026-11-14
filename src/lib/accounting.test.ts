import { describe, it, expect } from "vitest";
import { calculate, minor, money } from "./accounting";
import { demo } from "../test/ledger-fixture";
import type { Ledger, Transaction } from "./types";
const base: Ledger = {
  members: demo.members.slice(0, 1),
  expense_categories: demo.expense_categories,
  dues: [],
  transactions: [],
};
const tx = (v: Partial<Transaction>): Transaction => ({
  ...demo.transactions[0],
  member_id: "m0",
  amount: 500,
  ...v,
});
const run = (transactions: Transaction[], dues = base.dues) =>
  calculate({ ...base, transactions, dues });
describe("decimal-safe money", () => {
  it("parses exact cents", () => {
    expect(minor("0.29")).toBe(29);
    expect(minor("123.4")).toBe(12340);
    expect(money(29)).toBe("৳0.29");
  });
  it.each(["-1", "1.001", "NaN", "Infinity", "1e4", ""])(
    "rejects invalid money %s",
    (v) => expect(() => minor(v)).toThrow(),
  );
});
describe("ledger accounting", () => {
  it("credits contributions", () => {
    const r = run([tx({})]);
    expect(r.funds).toBe(50000);
    expect(r.collected).toBe(50000);
    expect(r.members.m0.credit).toBe(50000);
  });
  it("deducts group expenses", () => {
    const r = run([
      tx({
        type: "expense",
        amount: 300,
        member_id: null,
        funding_source: "group_funds",
      }),
    ]);
    expect(r.funds).toBe(-30000);
    expect(r.expenses).toBe(30000);
  });
  it("credits personal purchases without moving funds", () => {
    const r = run([
      tx({
        type: "expense",
        amount: 600,
        member_id: null,
        paid_by_member_id: "m0",
        funding_source: "member_personal",
        personal_settlement: "contribution",
      }),
    ]);
    expect(r.funds).toBe(0);
    expect(r.collected).toBe(0);
    expect(r.expenses).toBe(60000);
    expect(r.members.m0.credit).toBe(60000);
  });
  it("personal purchase loans create liability only", () => {
    const r = run([
      tx({
        type: "expense",
        amount: 200,
        member_id: null,
        paid_by_member_id: "m0",
        funding_source: "member_personal",
        personal_settlement: "loan",
      }),
    ]);
    expect(r.funds).toBe(0);
    expect(r.loans).toBe(20000);
    expect(r.members.m0.credit).toBe(0);
  });
  it("loans received never count as contributions", () => {
    const r = run([tx({ type: "loan_received", amount: 1000 })]);
    expect(r.funds).toBe(100000);
    expect(r.loans).toBe(100000);
    expect(r.collected).toBe(0);
    expect(r.members.m0.credit).toBe(0);
  });
  it("repayment reduces cash and liability, never expenses", () => {
    const r = run([
      tx({ type: "loan_received", amount: 1000 }),
      tx({ type: "loan_repayment", amount: 400 }),
    ]);
    expect(r.funds).toBe(60000);
    expect(r.loans).toBe(60000);
    expect(r.expenses).toBe(0);
  });
  it("calculates outstanding dues", () => {
    const r = run([tx({ amount: 700 })], [{ ...demo.dues[0], amount: 1000 }]);
    expect(r.members.m0.outstanding).toBe(30000);
    expect(r.members.m0.excess).toBe(0);
  });
  it("separates excess credit", () => {
    const r = run([tx({ amount: 1200 })], [{ ...demo.dues[0], amount: 1000 }]);
    expect(r.members.m0.outstanding).toBe(0);
    expect(r.members.m0.excess).toBe(20000);
  });
  it("ignores voided transactions and dues", () => {
    const r = run(
      [tx({ voided_at: new Date().toISOString() })],
      [{ ...demo.dues[0], voided_at: new Date().toISOString() }],
    );
    expect(r.funds).toBe(0);
    expect(r.outstanding).toBe(0);
  });
  it("handles all six combined scenarios", () => {
    const r = run([
      tx({ amount: 500 }),
      tx({
        type: "expense",
        amount: 300,
        funding_source: "group_funds",
        member_id: null,
      }),
      tx({
        type: "expense",
        amount: 600,
        funding_source: "member_personal",
        paid_by_member_id: "m0",
        personal_settlement: "contribution",
        member_id: null,
      }),
      tx({
        type: "expense",
        amount: 200,
        funding_source: "member_personal",
        paid_by_member_id: "m0",
        personal_settlement: "loan",
        member_id: null,
      }),
      tx({ type: "loan_received", amount: 1000 }),
      tx({ type: "loan_repayment", amount: 400 }),
    ]);
    expect(r.funds).toBe(80000);
    expect(r.expenses).toBe(110000);
    expect(r.loans).toBe(80000);
    expect(r.members.m0.credit).toBe(110000);
  });
  it("adds fractional BDT exactly", () =>
    expect(run([tx({ amount: "0.10" }), tx({ amount: "0.20" })]).funds).toBe(
      30,
    ));
});

describe("CSV export", () => {
  it("rejects empty exports", async () => {
    const { csvDownload } = await import("./accounting");
    expect(() => csvDownload("empty.csv", [])).toThrow("There is no data");
  });
});
