// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionForm } from "./ledger-forms";
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
