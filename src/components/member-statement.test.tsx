// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberStatement } from "./member-statement";
import { demo } from "../test/ledger-fixture";
import { setLanguage } from "../lib/i18n";
afterEach(() => {
  cleanup();
  setLanguage("en");
});
it("separates total paid, personal spending, fees and remaining club debt", async () => {
  const u = userEvent.setup();
  render(<MemberStatement data={demo} member={demo.members[0]} />);
  expect(screen.getByText("Total paid").closest("div")?.textContent).toContain(
    "৳4,600",
  );
  expect(screen.getByText("Cash given").closest("div")?.textContent).toContain(
    "৳4,000",
  );
  expect(
    screen.getByText("Spent personally").closest("div")?.textContent,
  ).toContain("৳600");
  expect(
    screen.getByText("Club owes member").closest("div")?.textContent,
  ).toContain("৳2,000");
  await u.click(screen.getByText("Fee breakdown"));
  expect(
    screen.getByText("Counted toward fees").closest("div")?.textContent,
  ).toContain("৳2,600");
  expect(screen.getByText("Monthly court contribution")).toBeTruthy();
});
it("shows all five payments plus personal spending, excluding cancelled entries and repayments from the total", async () => {
  const u = userEvent.setup();
  const payment = demo.transactions[0];
  const data = {
    ...demo,
    transactions: [
      ...[500, 390, 100, 150, 700].map((amount, i) => ({
        ...payment,
        id: `payment-${i}`,
        amount,
        description: `Payment ${i + 1}`,
      })),
      {
        ...demo.transactions.find((tx) => tx.id === "e3")!,
        amount: 200,
        personal_settlement: "loan" as const,
      },
      {
        ...payment,
        id: "cancelled",
        amount: 999,
        description: "Cancelled payment",
        voided_at: payment.created_at,
      },
      {
        ...payment,
        id: "other",
        member_id: "m1",
        amount: 999,
        description: "Another member",
      },
      {
        ...payment,
        id: "repaid",
        type: "loan_repayment" as const,
        amount: 50,
        description: "Refund",
      },
    ],
  };
  const open = vi.fn();
  render(
    <MemberStatement
      data={data}
      member={demo.members[0]}
      onTransaction={open}
    />,
  );
  expect(screen.getByText("Cash given").closest("div")?.textContent).toContain(
    "৳1,840",
  );
  expect(screen.getByText("Total paid").closest("div")?.textContent).toContain(
    "৳2,040",
  );
  for (const amount of [500, 390, 100, 150, 700, 200])
    expect(screen.getByLabelText("Individual payments").textContent).toContain(
      `৳${amount}`,
    );
  expect(
    screen.getByText("Already repaid by club").closest("div")?.textContent,
  ).toContain("৳50");
  expect(
    screen.getByText("Club owes member").closest("div")?.textContent,
  ).toContain("৳150");
  expect(screen.queryByText("Cancelled payment")).toBeNull();
  expect(screen.queryByText("Another member")).toBeNull();
  await u.click(screen.getByRole("button", { name: /Payment 1/ }));
  expect(open).toHaveBeenCalledWith(data.transactions[0]);
});
it("renders Bangla labels while preserving member names and payment descriptions", () => {
  setLanguage("bn");
  render(<MemberStatement data={demo} member={demo.members[0]} />);
  expect(screen.getByText("মোট দিয়েছেন")).toBeTruthy();
  expect(screen.getByText("নিজের টাকায় খরচ")).toBeTruthy();
  expect(screen.getByText("Court lighting replacement")).toBeTruthy();
});
