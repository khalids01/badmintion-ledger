// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionForm, DuesForm } from "./ledger-forms";
import { demo } from "../test/ledger-fixture";
import { today } from "../lib/accounting";
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
