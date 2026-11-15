import { getLanguage } from "./i18n";
import type { Ledger } from "./types";
export function minor(value: number | string): number {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Enter a positive amount with up to two decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 999999999999)
    throw new Error("Amount is too large.");
  return result;
}
export const money = (cents: number) =>
  "৳" +
  (cents / 100).toLocaleString("en-BD", {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
export function calculate(data: Ledger) {
  const members = Object.fromEntries(
    data.members.map((m) => [
      m.id,
      {
        credit: 0,
        cash: 0,
        purchases: 0,
        assigned: 0,
        outstanding: 0,
        excess: 0,
        loans: 0,
        borrowed: 0,
        repaid: 0,
      },
    ]),
  );
  let collected = 0,
    expenses = 0,
    funds = 0,
    loans = 0;
  for (const d of data.dues) {
    if (!d.voided_at && members[d.member_id])
      members[d.member_id].assigned += minor(d.amount);
  }
  for (const t of data.transactions) {
    if (t.voided_at) continue;
    const a = minor(t.amount),
      m = members[t.member_id || ""],
      payer = members[t.paid_by_member_id || ""];
    if (t.type === "contribution") {
      collected += a;
      funds += a;
      if (m) {
        m.credit += a;
        m.cash += a;
      }
    }
    if (t.type === "expense") {
      expenses += a;
      if (t.funding_source === "group_funds") funds -= a;
      else if (payer) {
        payer.purchases += a;
        if (t.personal_settlement === "contribution") payer.credit += a;
        else {
          payer.loans += a;
          payer.borrowed += a;
          loans += a;
        }
      }
    }
    if (t.type === "loan_received") {
      funds += a;
      loans += a;
      if (m) {
        m.loans += a;
        m.borrowed += a;
      }
    }
    if (t.type === "loan_repayment") {
      funds -= a;
      loans -= a;
      if (m) {
        m.loans -= a;
        m.repaid += a;
      }
    }
  }
  for (const m of Object.values(members)) {
    m.outstanding = Math.max(0, m.assigned - m.credit);
    m.excess = Math.max(0, m.credit - m.assigned);
  }
  return {
    members,
    collected,
    expenses,
    funds,
    loans,
    outstanding: Object.values(members).reduce((n, m) => n + m.outstanding, 0),
  };
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const day = (v: string) =>
  new Intl.DateTimeFormat(getLanguage() === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(v));
export function csvDownload(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) throw new Error("There is no data to export.");
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const csv = [
    keys.map(cell).join(","),
    ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
