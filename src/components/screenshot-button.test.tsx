// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("../lib/screenshot", () => ({ saveElementAsPng: vi.fn() }));
import { saveElementAsPng } from "../lib/screenshot";
import { ScreenshotButton } from "./screenshot-button";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("captures current content and reports screenshot failures", async () => {
  const u = userEvent.setup();
  render(
    <>
      <main>Club content</main>
      <ScreenshotButton />
    </>,
  );
  await u.click(screen.getByRole("button", { name: "Screenshot" }));
  expect(saveElementAsPng).toHaveBeenCalledWith(
    document.querySelector("main"),
    expect.stringMatching(/\.png$/),
  );
  vi.mocked(saveElementAsPng).mockRejectedValueOnce(
    new Error("Capture failed"),
  );
  await u.click(screen.getByRole("button", { name: "Screenshot" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Screenshot failed. Please try again.",
  );
});
