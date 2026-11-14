// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const native = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  getVersion: vi.fn(async () => "1.1.0"),
  check: vi.fn(),
  relaunch: vi.fn(async () => {}),
  openUrl: vi.fn(async () => {}),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: native.isTauri }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: native.getVersion }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: native.check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: native.relaunch }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: native.openUrl }));
import {
  UpdateProvider,
  UpdateControl,
  newerVersion,
  trustedDownload,
} from "./updates";
const mount = () =>
  render(
    <UpdateProvider>
      <UpdateControl />
    </UpdateProvider>,
  );
beforeEach(() => {
  native.isTauri.mockReturnValue(true);
  native.check.mockResolvedValue(null);
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: "Desktop",
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("signed update flow", () => {
  it("automatically checks after app startup", async () => {
    vi.useFakeTimers();
    mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(native.check).toHaveBeenCalledOnce();
    expect(screen.getByText("You’re up to date.")).toBeTruthy();
  });
  it("offers a signed update, installs and restarts", async () => {
    const install = vi.fn(async () => {});
    native.check.mockResolvedValue({
      version: "1.2.0",
      body: "Release notes",
      close: vi.fn(),
      downloadAndInstall: install,
    });
    const u = userEvent.setup();
    mount();
    await u.click(screen.getByText("Check for updates"));
    expect(await screen.findByText("A new version is available")).toBeTruthy();
    await u.click(screen.getByText("Install & restart"));
    expect(install).toHaveBeenCalledOnce();
    expect(native.relaunch).toHaveBeenCalledOnce();
  });
  it("never restarts after a failed signature/download", async () => {
    native.check.mockResolvedValue({
      version: "1.2.0",
      close: vi.fn(),
      downloadAndInstall: vi.fn(async () => {
        throw new Error("Signature verification failed");
      }),
    });
    const u = userEvent.setup();
    mount();
    await u.click(screen.getByText("Check for updates"));
    await u.click(await screen.findByText("Install & restart"));
    expect(
      await screen.findByText("Signature verification failed"),
    ).toBeTruthy();
    expect(native.relaunch).not.toHaveBeenCalled();
  });
  it("gives recovery instructions if restart fails", async () => {
    native.relaunch.mockRejectedValueOnce(new Error("Restart unavailable"));
    native.check.mockResolvedValue({
      version: "1.2.0",
      close: vi.fn(),
      downloadAndInstall: vi.fn(async () => {}),
    });
    const u = userEvent.setup();
    mount();
    await u.click(screen.getByText("Check for updates"));
    await u.click(await screen.findByText("Install & restart"));
    expect(
      (await screen.findAllByText(/Installed successfully/)).length,
    ).toBeGreaterThan(0);
  });
  it("does not invoke the native updater in a browser", async () => {
    native.isTauri.mockReturnValue(false);
    const u = userEvent.setup();
    mount();
    await u.click(screen.getByText("Check for updates"));
    expect(native.check).not.toHaveBeenCalled();
    expect(screen.getByText(/Updates are installed through/)).toBeTruthy();
  });
  it("opens a validated APK download on Android", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Android",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: "v1.2.0",
          body: "New release",
          assets: [
            {
              name: "badminton-ledger-android-arm64.apk",
              browser_download_url:
                "https://github.com/khalids01/badmintion-ledger/releases/download/v1.2.0/badminton-ledger-android-arm64.apk",
            },
          ],
        }),
      })),
    );
    const u = userEvent.setup();
    mount();
    await u.click(screen.getByText("Check for updates"));
    await u.click(await screen.findByText("Download APK"));
    expect(native.openUrl).toHaveBeenCalledWith(
      "https://github.com/khalids01/badmintion-ledger/releases/download/v1.2.0/badminton-ledger-android-arm64.apk",
    );
    expect(native.check).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
describe("release metadata validation", () => {
  it("compares numeric versions", () => {
    expect(newerVersion("v1.10.0", "1.9.0")).toBe(true);
    expect(newerVersion("1.1.0", "1.1.0")).toBe(false);
    expect(newerVersion("1.0.0", "1.1.0")).toBe(false);
    expect(newerVersion("invalid", "1.1.0")).toBe(false);
  });
  it.each([
    "http://github.com/khalids01/badmintion-ledger/releases/download/v1/a.apk",
    "https://github.com.evil.com/khalids01/badmintion-ledger/releases/download/v1/a.apk",
    "https://github.com/someone/another/releases/download/v1/a.apk",
  ])("rejects untrusted URL %s", (url) => {
    expect(() => trustedDownload(url)).toThrow();
  });
});
