// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../lib/supabase", () => ({ supabase: api }));
import { AdminSettings, loadAccess } from "./club";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const user = {
  id: "member",
  email: "member@example.com",
  name: "",
  created_at: "2026-11-14T00:00:00Z",
  confirmed: true,
  is_admin: false,
  approved: false,
  banned: false,
  last_sign_in_at: null,
};
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AdminSettings />
    </QueryClientProvider>,
  );
}
describe("club administration", () => {
  it("lets the administrator open signup and approve a pending member", async () => {
    const u = userEvent.setup();
    api.rpc.mockImplementation(async (method: string) => ({
      data:
        method === "admin_users"
          ? { signup_enabled: false, users: [user] }
          : null,
      error: null,
    }));
    mount();
    const toggle = await screen.findByRole("switch", {
      name: "Allow new signups",
    });
    expect((toggle as HTMLInputElement).checked).toBe(false);
    await u.click(toggle);
    expect(api.rpc).toHaveBeenCalledWith("manage_club", {
      action: "signup",
      target: undefined,
      value: "true",
    });
    await u.click(screen.getByRole("button", { name: "Approve into club" }));
    expect(api.rpc).toHaveBeenCalledWith("manage_club", {
      action: "approve",
      target: "member",
      value: undefined,
    });
  });
  it("shows ban restoration without offering approval while banned", async () => {
    const u = userEvent.setup();
    api.rpc.mockImplementation(async (method: string) => ({
      data:
        method === "admin_users"
          ? { signup_enabled: false, users: [{ ...user, banned: true }] }
          : null,
      error: null,
    }));
    mount();
    await u.click(await screen.findByRole("button", { name: "Unban" }));
    expect(api.rpc).toHaveBeenCalledWith("manage_club", {
      action: "unban",
      target: "member",
      value: undefined,
    });
    expect(
      screen.queryByRole("button", { name: "Approve into club" }),
    ).toBeNull();
  });
  it("shows server failures without claiming a change succeeded", async () => {
    const u = userEvent.setup();
    api.rpc.mockImplementation(async (method: string) => ({
      data:
        method === "admin_users"
          ? { signup_enabled: false, users: [user] }
          : null,
      error:
        method === "manage_club"
          ? new Error("Administrator access required.")
          : null,
    }));
    mount();
    await u.click(await screen.findByRole("button", { name: "Ban" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Administrator access required.",
    );
  });
  it("fails closed when membership cannot be verified", async () => {
    api.rpc.mockResolvedValue({ data: null, error: null });
    await expect(loadAccess()).rejects.toThrow("Could not verify club access.");
  });
});
