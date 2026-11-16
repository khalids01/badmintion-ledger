// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionForm, DuesForm } from "./ledger-forms";
import { demo } from "../test/ledger-fixture";
import { withLink, withTemporaryMark } from "../lib/presentation";
import { calculate, today } from "../lib/accounting";
afterEach(cleanup);
describe("optional expense dates", () => {
  it("uses today when the expense date is cleared", async () => {
    const save = vi.fn(),
      u = userEvent.setup();
    render(
      <TransactionForm
        data={demo}
        type="expense"
        busy={false}
        onSave={save}
        onVoid={() => {}}
      />,
    );
    await u.type(screen.getByLabelText("Amount (BDT)"), "300");
    await u.clear(screen.getByLabelText(/Date \(optional\)/));
    await u.click(screen.getByText("Save transaction"));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_date: today() + "T12:00:00+06:00",
      }),
    );
  });
  it("preserves a selected historical expense date", async () => {
    const save = vi.fn(),
      u = userEvent.setup();
    render(
      <TransactionForm
        data={demo}
        type="expense"
        busy={false}
        onSave={save}
        onVoid={() => {}}
      />,
    );
    await u.type(screen.getByLabelText("Amount (BDT)"), "300");
    const date = screen.getByLabelText(/Date \(optional\)/);
    await u.clear(date);
    await u.type(date, "2026-10-01");
    await u.click(screen.getByText("Save transaction"));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_date: "2026-10-01T12:00:00+06:00",
      }),
    );
  });
  it("still requires dates for contributions", async () => {
    const save = vi.fn(),
      u = userEvent.setup();
    render(
      <TransactionForm
        data={demo}
        type="contribution"
        busy={false}
        onSave={save}
        onVoid={() => {}}
      />,
    );
    await u.type(screen.getByLabelText("Amount (BDT)"), "300");
    await u.selectOptions(screen.getByLabelText("Member"), "m0");
    await u.clear(screen.getByLabelText("Date"));
    await u.click(screen.getByText("Save transaction"));
    expect(await screen.findByText("Select a date")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });
});

it("previews fees and warns that extra credit is separate from a loan", async () => {
  const u = userEvent.setup();
  render(
    <TransactionForm
      data={demo}
      type="contribution"
      busy={false}
      onSave={() => {}}
      onVoid={() => {}}
    />,
  );
  await u.selectOptions(screen.getByLabelText("Member"), "m0");
  await u.type(screen.getByLabelText("Amount (BDT)"), "200");
  expect(screen.getByRole("status").textContent).toContain("extra fee credit");
  expect(screen.getByRole("status").textContent).toContain(
    "record that part separately as a member loan",
  );
});
it("previews member-provided items without increasing club cash", async () => {
  const u = userEvent.setup();
  render(
    <TransactionForm
      data={demo}
      type="expense"
      initialPersonal
      busy={false}
      onSave={() => {}}
      onVoid={() => {}}
    />,
  );
  await u.type(screen.getByLabelText("Amount (BDT)"), "100");
  await u.selectOptions(screen.getByLabelText("Member who paid"), "m2");
  expect(screen.getByRole("status").textContent).toContain(
    "No club cash moves",
  );
  expect(screen.getByRole("status").textContent).toContain(
    "clears unpaid fees for Fahim Rahman",
  );
});

it("previews a new weekly period before assigning fees", async () => {
  const u = userEvent.setup();
  const save = vi.fn();
  render(
    <DuesForm
      members={demo.members}
      dues={demo.dues.map((d) => ({ ...d, title: "Weekly fee — Week 1" }))}
      busy={false}
      onSave={save}
    />,
  );
  await u.click(screen.getByRole("button", { name: "Weekly fee · ৳100" }));
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "Weekly fee — Week 2",
  );
  expect(screen.getByText("Review new charges")).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  await u.click(
    screen.getByRole("button", { name: "Assign dues to 6 members" }),
  );
  expect(save).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ title: "Weekly fee — Week 2", amount: "100" }),
    ]),
  );
});

describe("payment used to repay a loan", () => {
  async function setup(amount = "500") {
    const save = vi.fn(),
      u = userEvent.setup();
    render(
      <TransactionForm
        data={demo}
        type="contribution"
        busy={false}
        onSave={save}
        onVoid={() => {}}
      />,
    );
    await u.selectOptions(screen.getByLabelText("Member"), "m2");
    await u.type(screen.getByLabelText("Amount (BDT)"), amount);
    await u.click(screen.getByLabelText("Use this payment to repay a loan"));
    return { save, u };
  }
  it("saves the full fee payment and a linked repayment to the lender", async () => {
    const { save, u } = await setup();
    expect(screen.getByRole("status").textContent).toContain(
      "Cash in hand will be ৳7,400",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "remaining loan ৳1,500",
    );
    await u.click(screen.getByText("Save transaction"));
    const [payment, repayment] = save.mock.calls[0][0];
    expect(payment).toMatchObject({
      type: "contribution",
      amount: "500",
      member_id: "m2",
    });
    expect(repayment).toMatchObject({
      type: "loan_repayment",
      amount: "500",
      member_id: "m0",
    });
    expect(payment.notes).toContain(repayment.id);
    expect(repayment.notes).toContain(payment.id);
  });
  it("allows a partial repayment and leaves the rest in club cash", async () => {
    const { save, u } = await setup();
    await u.clear(screen.getByLabelText("Repayment amount (BDT)"));
    await u.type(screen.getByLabelText("Repayment amount (BDT)"), "200");
    expect(screen.getByRole("status").textContent).toContain(
      "Cash in hand will be ৳7,700",
    );
    await u.click(screen.getByText("Save transaction"));
    expect(save.mock.calls[0][0][1].amount).toBe("200");
  });
  for (const [amount, repayment] of [
    ["500", "501"],
    ["2500", "2100"],
    ["500", "0"],
    ["500", "oops"],
  ]) {
    it(`rejects invalid repayment ${repayment} on payment ${amount}`, async () => {
      const { save, u } = await setup(amount);
      await u.clear(screen.getByLabelText("Repayment amount (BDT)"));
      await u.type(screen.getByLabelText("Repayment amount (BDT)"), repayment);
      await u.click(screen.getByText("Save transaction"));
      expect(save).not.toHaveBeenCalled();
    });
  }
  it("keeps normal payment saving when repayment is switched off", async () => {
    const { save, u } = await setup();
    await u.click(screen.getByLabelText("Use this payment to repay a loan"));
    await u.click(screen.getByText("Save transaction"));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ type: "contribution", amount: "500" }),
    );
    expect(Array.isArray(save.mock.calls[0][0])).toBe(false);
  });
});

describe("repayment from a recorded payment", () => {
  it("inserts only a 500 repayment, leaving the original payer credited", async () => {
    const u = userEvent.setup(),
      save = vi.fn(
        async (value: Record<string, unknown> | Record<string, unknown>[]) => {
          void value;
          return true;
        },
      );
    const record = {
      ...demo.transactions[0],
      id: crypto.randomUUID(),
      amount: 500,
      member_id: "m2",
    };
    const data = { ...demo, transactions: [...demo.transactions, record] };
    render(
      <TransactionForm
        data={data}
        type="contribution"
        record={record}
        busy={false}
        onSave={save}
        onVoid={() => {}}
      />,
    );
    await u.click(screen.getByText("Apply to loan repayment"));
    await u.click(screen.getByText("Save repayment"));
    const repayment = save.mock.calls[0][0];
    expect(Array.isArray(repayment)).toBe(false);
    expect(repayment).toMatchObject({
      type: "loan_repayment",
      member_id: "m0",
      amount: "500",
      payment_method: "mobile_wallet",
    });
    const result = calculate({
      ...data,
      transactions: [
        ...data.transactions,
        repayment as unknown as typeof record,
      ],
    });
    expect(result.members.m0.loans).toBe(150000);
    expect(result.members.m2.credit).toBe(200000);
    expect(result.funds).toBe(calculate(data).funds - 50000);
    expect(record.amount).toBe(500);
  });
  it("excludes voided allocations and rejects use above remaining payment", async () => {
    const u = userEvent.setup(),
      save = vi.fn();
    const record = {
      ...demo.transactions[0],
      id: crypto.randomUUID(),
      amount: 500,
    };
    const allocation = {
      ...demo.transactions[0],
      id: crypto.randomUUID(),
      type: "loan_repayment" as const,
      amount: 300,
      notes: withLink("", record.id),
    };
    const data = {
      ...demo,
      transactions: [
        ...demo.transactions,
        record,
        allocation,
        {
          ...allocation,
          id: crypto.randomUUID(),
          amount: 100,
          voided_at: record.created_at,
        },
      ],
    };
    render(
      <TransactionForm
        data={data}
        type="contribution"
        record={record}
        busy={false}
        onSave={save}
        onVoid={() => {}}
      />,
    );
    await u.click(screen.getByText("Apply to loan repayment"));
    expect(
      (screen.getByLabelText("Repayment amount (BDT)") as HTMLInputElement)
        .value,
    ).toBe("200");
    await u.clear(screen.getByLabelText("Repayment amount (BDT)"));
    await u.type(screen.getByLabelText("Repayment amount (BDT)"), "201");
    await u.click(screen.getByText("Save repayment"));
    expect(save).not.toHaveBeenCalled();
    expect(
      screen.getByText(/cannot exceed the remaining unapplied/),
    ).toBeTruthy();
  });
});
it("leaves temporary players out of default fee assignments and entry presets", async () => {
  const u = userEvent.setup(),
    save = vi.fn();
  const members = demo.members.map((m, i) =>
    i === 0 ? { ...m, notes: withTemporaryMark("Guest") } : m,
  );
  render(<DuesForm members={members} busy={false} onSave={save} />);
  expect(
    (
      screen.getByRole("checkbox", {
        name: new RegExp(members[0].name),
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  await u.click(
    screen.getByRole("checkbox", { name: new RegExp(members[0].name) }),
  );
  await u.click(screen.getByText("Entry fee · ৳500"));
  expect(
    (
      screen.getByRole("checkbox", {
        name: new RegExp(members[0].name),
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  await u.click(screen.getByText("Assign dues to 5 members"));
  expect(
    save.mock.calls[0][0].some(
      (row: { member_id: string }) => row.member_id === members[0].id,
    ),
  ).toBe(false);
});
