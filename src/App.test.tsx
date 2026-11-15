// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Ledger } from "./lib/types";
import { calculate } from "./lib/accounting";
import { demo } from "./test/ledger-fixture";
const store = vi.hoisted(() => ({
  data: null as Ledger | null,
  status: "active",
  admin: true,
  reads: 0,
  insertError: false,
  batches: [] as unknown[],
}));
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
    rpc: async (name: string) => ({
      data:
        name === "account_access"
          ? { status: store.status, is_admin: store.admin, owner_id: "demo" }
          : { signup_enabled: false, users: [] },
      error: null,
    }),
    from: (table: keyof Ledger) => {
      store.reads++;
      return {
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
          store.batches.push(value);
          if (store.insertError) return { error: { message: "Save failed" } };
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
      };
    },
  },
}));
vi.mock("./components/ledger-chart", () => ({
  default: () => <div>Monthly chart</div>,
}));
import App from "./App";
import { setLanguage } from "./lib/i18n";
async function mount() {
  const result = render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  );
  await screen.findByText("Cash in hand");
  return result;
}
afterEach(() => {
  cleanup();
  setLanguage("en");
});
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  store.data = structuredClone(demo);
  store.status = "active";
  store.admin = true;
  store.reads = 0;
  store.insertError = false;
  store.batches = [];
});
describe("ledger workflows", () => {
  it("loads the saved ledger without a sample mode", async () => {
    await mount();
    expect(screen.queryByText(/Interactive preview/)).toBeNull();
    expect(screen.getByText("Cash in hand")).toBeTruthy();
    expect(screen.getByText("৳7,400")).toBeTruthy();
  });
  it("shows weekly periods and app branding on the home screen", async () => {
    const u = userEvent.setup();
    await mount();
    expect(screen.getByText(/Weekly cash received and spent/)).toBeTruthy();
    const selector = screen.getByLabelText("Chart weeks") as HTMLSelectElement;
    expect(selector.value).toBe("2");
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
    await u.click(screen.getByText("Someone paid money"));
    await u.type(screen.getByLabelText("Amount (BDT)"), "500");
    await u.selectOptions(screen.getByLabelText("Member"), "m0");
    await u.type(screen.getByLabelText("Description"), "Test contribution");
    await u.click(screen.getByText("Save transaction"));
    expect(screen.getByText("৳7,900")).toBeTruthy();
    await u.click(screen.getAllByText("Transactions", { exact: true })[0]);
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
    await u.click(screen.getByText("Repay a member"));
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

describe("club access gates", () => {
  for (const status of ["pending", "banned"]) {
    it(`does not fetch or show ledger data for ${status} accounts`, async () => {
      store.status = status;
      store.admin = false;
      render(
        <QueryClientProvider client={new QueryClient()}>
          <App />
        </QueryClientProvider>,
      );
      await screen.findByText(
        status === "pending" ? "Waiting for approval" : "Access suspended",
      );
      expect(screen.queryByText("Cash in hand")).toBeNull();
      expect(store.reads).toBe(0);
    });
  }
  it("gives approved members a view without editing or administration controls", async () => {
    store.admin = false;
    await mount();
    expect(screen.getByText("Your club’s ledger")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add transaction" }),
    ).toBeNull();
    expect(screen.queryByText("Club administration")).toBeNull();
  });
});

it("hides cached ledger data when an existing session becomes banned", async () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
  await screen.findByText("Cash in hand");
  await act(async () => {
    client.setQueryData(["account-access", "demo"], {
      status: "banned",
      is_admin: false,
      owner_id: null,
    });
  });
  await screen.findByText("Access suspended");
  expect(screen.queryByText("Cash in hand")).toBeNull();
  expect(client.getQueryData(["ledger", "demo"])).toBeUndefined();
});

describe("balance explanations", () => {
  it("opens a cash breakdown and the members the club owes", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getByRole("button", { name: /Cash in hand/ }));
    expect(await screen.findByText("Cash received from members")).toBeTruthy();
    await u.click(screen.getByLabelText("Close"));
    await u.click(screen.getByRole("button", { name: /Club must repay/ }));
    expect(await screen.findByText("Who must the club repay?")).toBeTruthy();
  });
  it("starts with a choice and opens the member-funded purchase form", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getByRole("button", { name: "Add transaction" }));
    const dialog = screen.getByRole("dialog");
    await u.click(
      within(dialog).getByRole("button", { name: /Someone provided items/ }),
    );
    expect(
      (screen.getByLabelText("Who paid?") as HTMLSelectElement).value,
    ).toBe("member_personal");
    expect(
      screen.getByLabelText("Should this count as their payment or a loan?"),
    ).toBeTruthy();
  });
});

describe("member payment clarity and preferences", () => {
  it("opens any member directly from the dashboard and shows cash plus personal spending", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(
      screen.getByRole("button", { name: /Shawon Ahmed.*Total paid/ }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Total paid").closest("div")?.textContent,
    ).toContain("৳4,600");
    expect(
      within(dialog).getByText("Cash given").closest("div")?.textContent,
    ).toContain("৳4,000");
  });
  it("moves profile selection into settings without changing administrator access", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getAllByText("Members", { exact: true })[0]);
    await u.click(screen.getByText("Add member"));
    expect(screen.queryByLabelText(/This is me/)).toBeNull();
    await u.click(screen.getByLabelText("Close"));
    await u.click(screen.getAllByText("Settings", { exact: true })[0]);
    await u.selectOptions(screen.getByLabelText("My member profile"), "m1");
    expect(store.data!.members.find((m) => m.id === "m0")!.is_me).toBe(false);
    expect(store.data!.members.find((m) => m.id === "m1")!.is_me).toBe(true);
    expect(store.admin).toBe(true);
    await u.selectOptions(screen.getByLabelText("My member profile"), "");
    expect(store.data!.members.some((m) => m.is_me)).toBe(false);
  });
  it("switches to Bangla, preserves an open form and saves the language preference", async () => {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getByText("Someone paid money"));
    await u.type(screen.getByLabelText("Amount (BDT)"), "390");
    await u.selectOptions(
      within(screen.getByRole("dialog")).getByLabelText("Language"),
      "bn",
    );
    expect(screen.getByRole("heading", { name: "ফি জমা" })).toBeTruthy();
    expect(
      (screen.getByLabelText("টাকার পরিমাণ (৳)") as HTMLInputElement).value,
    ).toBe("390");
    expect(document.documentElement.lang).toBe("bn");
    expect(localStorage.getItem("ledger-language")).toBe("bn");
    await u.click(screen.getByLabelText("বন্ধ করুন"));
    await u.click(screen.getAllByText("সদস্য", { exact: true })[0]);
    expect(screen.getByText("সক্রিয় সদস্য")).toBeTruthy();
    expect(screen.getAllByText("Shawon Ahmed").length).toBeGreaterThan(0);
    await u.selectOptions(screen.getByLabelText("ভাষা"), "en");
    expect(screen.getByText("Active members")).toBeTruthy();
  });
});

describe("linked payment persistence", () => {
  async function fill() {
    const u = userEvent.setup();
    await mount();
    await u.click(screen.getByText("Someone paid money"));
    await u.selectOptions(screen.getByLabelText("Member"), "m2");
    await u.type(screen.getByLabelText("Amount (BDT)"), "500");
    await u.click(screen.getByLabelText("Use this payment to repay a loan"));
    return u;
  }
  it("sends one bulk insert and updates both members and club cash", async () => {
    const u = await fill();
    await u.click(screen.getByText("Save transaction"));
    expect(store.batches).toHaveLength(1);
    expect(store.batches[0]).toHaveLength(2);
    const result = calculate(store.data!);
    expect(result.funds).toBe(740000);
    expect(result.members.m2.outstanding).toBe(0);
    expect(result.members.m0.loans).toBe(150000);
    await u.click(screen.getAllByText("Transactions", { exact: true })[0]);
    await u.click(screen.getByText("Loan repaid from Fahim Rahman's payment"));
    await u.click(screen.getByText("View linked entry"));
    expect((screen.getByLabelText("Member") as HTMLSelectElement).value).toBe(
      "m2",
    );
    expect(
      (screen.getByLabelText("Notes (optional)") as HTMLTextAreaElement).value,
    ).toBe("");
  });
  it("keeps the form on failure and reuses IDs when retrying", async () => {
    const u = await fill();
    store.insertError = true;
    await u.click(screen.getByText("Save transaction"));
    expect(await screen.findByText("Save failed")).toBeTruthy();
    expect(store.data!.transactions).toHaveLength(demo.transactions.length);
    expect(screen.getByRole("dialog")).toBeTruthy();
    store.insertError = false;
    await u.click(screen.getByText("Save transaction"));
    expect(store.batches[1]).toEqual(store.batches[0]);
  });
});
