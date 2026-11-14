// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Ledger } from "./lib/types";
import { demo } from "./test/ledger-fixture";
const store = vi.hoisted(() => ({ data: null as Ledger | null }));
vi.mock("./lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "demo", email: "admin@example.com" } } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: (table: keyof Ledger) => ({
      select: () => ({
        order: async () => ({ data: store.data![table], error: null }),
        then: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: store.data![table], error: null }).then(
            resolve,
          ),
      }),
      insert: async (
        value: Record<string, unknown> | Record<string, unknown>[],
      ) => {
        const stamp = new Date().toISOString();
        const list = Array.isArray(value) ? value : [value];
        store.data = {
          ...store.data!,
          [table]: [
            ...store.data![table],
            ...list.map((v) => ({
              id: crypto.randomUUID(),
              created_at: stamp,
              updated_at: stamp,
              voided_at: null,
              ...v,
            })),
          ],
        };
        return { error: null };
      },
      update: (value: Record<string, unknown>) => ({
        eq: async (_key: string, id: string) => {
          store.data = {
            ...store.data!,
            [table]: store.data![table].map((v) =>
              v.id === id ? { ...v, ...value } : v,
            ),
          };
          return { error: null };
        },
      }),
    }),
  },
}));
vi.mock("./components/ledger-chart", () => ({
  default: () => <div>Monthly chart</div>,
}));
import App from "./App";
async function mount() {
  const result = render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  );
  await screen.findByText("Available Group Funds");
  return result;
}
afterEach(cleanup);
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  store.data = structuredClone(demo);
});
describe("ledger workflows", () => {
  it("loads the saved ledger without a sample mode", async () => {
    await mount();
    expect(screen.queryByText(/Interactive preview/)).toBeNull();
    expect(screen.getByText("Available Group Funds")).toBeTruthy();
    expect(screen.getByText("৳7,400")).toBeTruthy();
  });
  it("shows weekly periods and app branding on the home screen", async () => {
    const u = userEvent.setup();
    await mount();
    expect(screen.getByText(/Weekly contributions and expenses/)).toBeTruthy();
    const selector = screen.getByLabelText("Chart weeks") as HTMLSelectElement;
    expect(selector.value).toBe("12");
    await u.selectOptions(selector, "4");
    expect(selector.value).toBe("4");
    expect(screen.getByAltText("Badminton Ledger")).toBeTruthy();
  });
  it("creates and edits a member", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getAllByText("Members", { exact: true })[0]);
    await u.click(screen.getByText("Add member"));
    const dialog = screen.getByRole("dialog");
    await u.type(within(dialog).getByLabelText("Full name"), "Test Player");
    await u.click(within(dialog).getByText("Save member"));
    expect(screen.getByText("Test Player")).toBeTruthy();
    await u.click(screen.getByLabelText("Edit Test Player"));
    await u.clear(screen.getByLabelText("Full name"));
    await u.type(screen.getByLabelText("Full name"), "Updated Player");
    await u.click(screen.getByText("Save member"));
    expect(screen.getByText("Updated Player")).toBeTruthy();
  });
  it("saves a contribution and updates funds", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getByText("Add contribution"));
    await u.type(screen.getByLabelText("Amount (BDT)"), "500");
    await u.selectOptions(screen.getByLabelText("Member"), "m0");
    await u.type(screen.getByLabelText("Description"), "Test contribution");
    await u.click(screen.getByText("Save transaction"));
    expect(screen.getByText("৳7,900")).toBeTruthy();
    expect(screen.getByText("Test contribution")).toBeTruthy();
  });
  it("assigns custom dues to a selected member", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getByText("Assign dues", { exact: true }));
    await u.type(screen.getByLabelText("Default amount (BDT)"), "500");
    await u.click(screen.getByLabelText("Select all active members"));
    await u.click(screen.getByLabelText("Fahim Rahman"));
    await u.type(
      screen.getByLabelText("Custom amount for Fahim Rahman"),
      "700",
    );
    await u.click(screen.getByText("Assign dues to 1 members"));
    expect(screen.getByText("৳3,700")).toBeTruthy();
  });
  it("prevents excessive loan repayment", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getByText("Repay loan"));
    await u.selectOptions(screen.getByLabelText("Lender"), "m0");
    await u.type(screen.getByLabelText("Amount (BDT)"), "2500");
    await u.click(screen.getByText("Save transaction"));
    expect(await screen.findByText(/Repayment exceeds/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("voids a transaction with a reason", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getAllByText("Transactions", { exact: true })[0]);
    await u.click(screen.getByText("Evening court booking"));
    await u.click(screen.getByText("Void transaction"));
    await u.type(screen.getByLabelText("Reason"), "Duplicate court entry");
    await u.click(screen.getByText("Confirm void transaction"));
    await u.click(screen.getAllByText("Dashboard", { exact: true })[0]);
    expect(screen.getByText("৳9,800")).toBeTruthy();
  });
  it("exports transactions through a CSV download", async () => {
    const create = vi.fn(() => "blob:ledger-export"),
      revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: create,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revoke,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getAllByText("Transactions", { exact: true })[0]);
    await u.click(screen.getByText("Export CSV"));
    expect(create).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:ledger-export");
    click.mockRestore();
  });
});
