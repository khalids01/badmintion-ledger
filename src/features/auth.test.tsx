// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const setupStatus = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({ data: false, error: null })),
}));
const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({
  supabase: { auth, rpc: setupStatus.rpc },
}));
import { Auth } from "./auth";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
beforeEach(() => {
  setupStatus.rpc.mockResolvedValue({ data: false, error: null });
});
describe("private administrator access", () => {
  it("hides setup after the administrator has been registered", async () => {
    setupStatus.rpc.mockResolvedValueOnce({ data: true, error: null });
    render(<Auth />);
    await screen.findByText("Sign in");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      screen.queryByText("First time? Set up administrator account"),
    ).toBeNull();
    expect(screen.queryByText("Explore the sample ledger")).toBeNull();
  });
  it("toggles password visibility without clearing the password", async () => {
    const u = userEvent.setup();
    render(<Auth />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    await u.type(password, "a-private-password");
    expect(password.type).toBe("password");
    await u.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.type).toBe("text");
    expect(password.value).toBe("a-private-password");
    await u.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.type).toBe("password");
  });
  it("preserves entered credentials when sign-in fails", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials"),
    });
    const u = userEvent.setup();
    render(<Auth />);
    await u.type(screen.getByLabelText("Password"), "test-password-123");
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid login credentials")).toBeTruthy();
    expect(
      (screen.getByLabelText("Email address") as HTMLInputElement).value,
    ).toBe("khalids8774@gmail.com");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe(
      "test-password-123",
    );
  });
  it("restricts first-time setup to the designated administrator", async () => {
    auth.signUp.mockResolvedValue({ error: null });
    const u = userEvent.setup();
    render(<Auth />);
    await u.click(
      await screen.findByText("First time? Set up administrator account"),
    );
    const email = screen.getByLabelText("Email address") as HTMLInputElement;
    expect(email.readOnly).toBe(true);
    await u.type(screen.getByLabelText("New password"), "test-password-123");
    await u.click(screen.getByText("Create administrator account"));
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "khalids8774@gmail.com" }),
    );
    expect(await screen.findByText(/Check your email to confirm/)).toBeTruthy();
  });
  it("saves a new recovery password", async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    const recovered = vi.fn(),
      u = userEvent.setup();
    render(<Auth resetMode onRecovered={recovered} />);
    await u.type(
      screen.getByLabelText("New password"),
      "replacement-password-123",
    );
    await u.click(screen.getByText("Save new password"));
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "replacement-password-123",
    });
    expect(recovered).toHaveBeenCalled();
  });
});
