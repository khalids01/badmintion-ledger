import { describe, it, expect } from "vitest";
import { weeklyActivity, dhakaDate } from "./reporting";
import { demo } from "../test/ledger-fixture";
import type { Ledger, Transaction } from "./types";
const base: Ledger = { ...demo, transactions: [], dues: [] };
const row = (values: Partial<Transaction>): Transaction => ({
  ...demo.transactions[0],
  amount: 100,
  ...values,
});
describe("weekly activity in Dhaka", () => {
  it("uses Monday–Sunday weeks and includes empty weeks", () => {
    const result = weeklyActivity(base, 4, "2026-11-15");
    expect(result).toHaveLength(4);
    expect(result[3].label).toBe("9 Nov");
    expect(result[3].range).toContain("15 Nov 2026");
    expect(result.every((w) => w.Contributions === 0 && w.Expenses === 0)).toBe(
      true,
    );
  });
  it("assigns transactions by Dhaka date across the UTC Sunday boundary", () => {
    const data = {
      ...base,
      transactions: [
        row({ transaction_date: "2026-11-08T17:59:00Z", amount: 100 }),
        row({ transaction_date: "2026-11-08T18:00:00Z", amount: 200 }),
      ],
    };
    const result = weeklyActivity(data, 2, "2026-11-15");
    expect(dhakaDate(data.transactions[1].transaction_date)).toBe("2026-11-09");
    expect(result.map((w) => w.Contributions)).toEqual([100, 200]);
  });
  it("uses central accounting rules for personal purchases, loans and voids", () => {
    const date = "2026-11-10T12:00:00+06:00";
    const data = {
      ...base,
      transactions: [
        row({ transaction_date: date, amount: "0.10" }),
        row({ transaction_date: date, amount: "0.20" }),
        row({
          transaction_date: date,
          type: "expense",
          amount: 600,
          funding_source: "member_personal",
          paid_by_member_id: "m0",
          personal_settlement: "contribution",
        }),
        row({ transaction_date: date, type: "loan_received", amount: 1000 }),
        row({ transaction_date: date, amount: 999, voided_at: date }),
      ],
    };
    const [week] = weeklyActivity(data, 1, "2026-11-15");
    expect(week.Contributions).toBe(0.3);
    expect(week.Expenses).toBe(600);
  });
  it("keeps year boundaries in the correct week", () => {
    const result = weeklyActivity(
      {
        ...base,
        transactions: [row({ transaction_date: "2027-01-01T12:00:00+06:00" })],
      },
      1,
      "2027-01-03",
    );
    expect(result[0].label).toBe("28 Dec");
    expect(result[0].Contributions).toBe(100);
  });
});
