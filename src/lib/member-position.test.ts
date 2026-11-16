import { describe, expect, it } from "vitest";
import { memberPosition } from "./presentation";
import { demo } from "../test/ledger-fixture";

describe("member position", () => {
  it("separates fees, gross payments, refunds and outstanding loan", () => {
    const position = memberPosition(demo, demo.members[0].id);
    expect(position.totalPaid).toBe(460000);
    expect(position.cashPaid).toBe(400000);
    expect(position.personalSpent).toBe(60000);
    expect(position.feePaid).toBe(260000);
    expect(position.loan).toBe(200000);
    expect(position.netPaid).toBe(position.totalPaid - position.repaid);
  });
  it("flags missing collector funding without inventing a personal loan", () => {
    const expense = demo.transactions.find(tx => tx.type === "expense" && tx.funding_source === "group_funds")!;
    const data = { ...demo, dues: [], transactions: [{ ...expense, amount: 5000 }] };
    const collector = memberPosition(data, demo.members[0].id, true);
    expect(collector.unrecorded).toBe(500000);
    expect(collector.collectorMoneyUsed).toBe(500000);
    expect(collector.loan).toBe(0);
    expect(collector.totalPaid).toBe(0);
    expect(memberPosition(data, demo.members[1].id).unrecorded).toBe(0);
  });
  it("ignores cancelled funding and does not subtract repayments twice", () => {
    const contribution = demo.transactions.find(tx => tx.type === "contribution")!;
    const id = contribution.member_id!;
    const data = { ...demo, dues: [], transactions: [
      { ...contribution, amount: 500 },
      { ...contribution, id: "loan", type: "loan_received" as const, amount: 1500 },
      { ...contribution, id: "repay", type: "loan_repayment" as const, amount: 500 },
      { ...contribution, id: "cancelled", amount: 999, voided_at: contribution.created_at },
    ] };
    const p = memberPosition(data, id, true);
    expect(p.totalPaid).toBe(200000);
    expect(p.feePaid).toBe(50000);
    expect(p.loan).toBe(100000);
    expect(p.netPaid).toBe(150000);
    expect(p.unrecorded).toBe(0);
    expect(p.collectorMoneyUsed).toBe(p.netPaid);
  });
});
