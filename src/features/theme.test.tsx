// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, ThemeControl } from "./theme";
afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
describe("appearance preference", () => {
  it("uses system dark mode and persists an explicit choice", async () => {
    const media = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    const u = userEvent.setup();
    const view = render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    await u.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("ledger-theme")).toBe("light");
    view.unmount();
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    vi.unstubAllGlobals();
  });
});
