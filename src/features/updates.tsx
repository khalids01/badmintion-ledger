import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Download,
  RefreshCw,
  CheckCircle2,
  ArrowUpCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { version as bundledVersion } from "../../package.json";
export type UpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "installing"
  | "restart"
  | "error"
  | "browser";
export function newerVersion(candidate: string, current: string) {
  const parse = (v: string) =>
    v.replace(/^v/, "").split(/[+-]/)[0].split(".").map(Number);
  const a = parse(candidate),
    b = parse(current);
  if (
    a.length !== 3 ||
    b.length !== 3 ||
    [...a, ...b].some((v) => !Number.isInteger(v) || v < 0)
  )
    return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
const repository =
  "https://api.github.com/repos/khalids01/badmintion-ledger/releases/latest";
export function trustedDownload(url: string) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.origin !== "https://github.com" ||
    !!u.username ||
    !!u.password ||
    !u.pathname.startsWith("/khalids01/badmintion-ledger/releases/download/")
  )
    throw new Error("The update download address is not trusted.");
  return u.href;
}
interface Updates {
  status: UpdateStatus;
  currentVersion: string;
  version: string;
  notes: string;
  progress: number | null;
  error: string;
  checkUpdates: () => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
  dismissed: boolean;
  mobile: boolean;
}
const UpdatesContext = createContext<Updates | null>(null);
export function UpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>("idle"),
    [currentVersion, setCurrentVersion] = useState(bundledVersion),
    [version, setVersion] = useState(""),
    [notes, setNotes] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState(""),
    [dismissed, setDismissed] = useState(false);
  const update = useRef<Update | null>(null),
    download = useRef(""),
    working = useRef(false),
    mounted = useRef(true),
    hasChecked = useRef(false);
  const mobile = isTauri() && /android|iphone|ipad/i.test(navigator.userAgent);
  async function checkUpdates() {
    if (working.current || status === "restart") return;
    hasChecked.current = true;
    if (!isTauri()) {
      setStatus("browser");
      return;
    }
    working.current = true;
    setStatus("checking");
    setError("");
    try {
      const current = await getVersion();
      setCurrentVersion(current);
      if (mobile) {
        const response = await fetch(repository, {
          headers: { Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(15000),
        });
        if (response.status === 404) {
          setStatus("current");
          return;
        }
        if (!response.ok)
          throw new Error(
            "Could not check for updates. Try again when you are online.",
          );
        const release = await response.json();
        if (!newerVersion(release.tag_name, current)) {
          setStatus("current");
          return;
        }
        const asset = release.assets?.find(
          (a: { name: string }) =>
            a.name === "badminton-ledger-android-arm64.apk",
        );
        if (!asset)
          throw new Error(
            "The Android update is not ready yet. Try again later.",
          );
        download.current = trustedDownload(asset.browser_download_url);
        setVersion(release.tag_name.replace(/^v/, ""));
        setNotes(release.body || "");
      } else {
        await update.current?.close();
        update.current = null;
        const candidate = await check({ timeout: 15000 });
        if (!candidate) {
          setStatus("current");
          return;
        }
        update.current = candidate;
        setVersion(candidate.version);
        setNotes(candidate.body || "");
      }
      setDismissed(false);
      setStatus("available");
    } catch (e) {
      if (mounted.current) {
        const detail = e instanceof Error ? e.message : String(e);
        if (/404|not found/i.test(detail)) {
          setStatus("current");
          setError("");
          return;
        }
        setError(detail);
        setStatus("error");
      }
    } finally {
      working.current = false;
    }
  }
  async function install() {
    if (working.current) return;
    if (status === "restart") {
      try {
        await relaunch();
      } catch (e) {
        setError(
          "The update is installed. Please close and reopen the app. " +
            String(e),
        );
      }
      return;
    }
    if (status !== "available") return;
    working.current = true;
    setError("");
    try {
      if (mobile) {
        await openUrl(trustedDownload(download.current));
        return;
      }
      if (!update.current) throw new Error("Check for updates again.");
      setStatus("installing");
      setProgress(null);
      let received = 0,
        total = 0;
      await update.current.downloadAndInstall(
        (event) => {
          if (event.event === "Started") total = event.data.contentLength || 0;
          if (event.event === "Progress") {
            received += event.data.chunkLength;
            setProgress(
              total
                ? Math.min(100, Math.round((received / total) * 100))
                : null,
            );
          }
        },
        { timeout: 600000 },
      );
      setStatus("restart");
      try {
        await relaunch();
      } catch {
        setError(
          "Installed successfully. Close and reopen the app to finish updating.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    } finally {
      working.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => {
      if (!hasChecked.current) void checkUpdates();
    }, 1500);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, []);
  return (
    <UpdatesContext.Provider
      value={{
        status,
        currentVersion,
        version,
        notes,
        progress,
        error,
        checkUpdates,
        install,
        dismiss: () => setDismissed(true),
        dismissed,
        mobile,
      }}
    >
      {children}
      <UpdateBanner />
    </UpdatesContext.Provider>
  );
}
export function UpdateControl() {
  const state = useContext(UpdatesContext);
  if (!state) return null;
  const busy = state.status === "checking" || state.status === "installing";
  return (
    <section className="update-control" aria-label="Application updates">
      <div className="update-heading">
        <div>
          <strong>Application updates</strong>
          <small>Version {state.currentVersion}</small>
        </div>
        <ArrowUpCircle size={20} />
      </div>
      <p role="status">
        {state.status === "checking"
          ? "Checking for updates…"
          : state.status === "current"
            ? "You’re up to date."
            : state.status === "available"
              ? "Version " + state.version + " is available."
              : state.status === "installing"
                ? "Downloading update" +
                  (state.progress !== null ? " · " + state.progress + "%" : "…")
                : state.status === "restart"
                  ? "Update installed. Restart to finish."
                  : state.status === "browser"
                    ? "Updates are installed through the desktop or Android app."
                    : state.status === "error"
                      ? "Could not complete the update."
                      : "Checks automatically when you open the app."}
      </p>
      {state.notes &&
        ["available", "installing", "restart"].includes(state.status) && (
          <details className="release-notes">
            <summary>What’s new</summary>
            <p>{state.notes}</p>
          </details>
        )}
      {state.error && <p className="update-error">{state.error}</p>}
      {state.status === "installing" && (
        <progress max={100} value={state.progress ?? undefined} />
      )}
      <div className="update-actions">
        {(state.status === "available" || state.status === "restart") && (
          <button
            type="button"
            className="button primary"
            onClick={() => void state.install()}
          >
            <Download size={15} />
            {state.status === "restart"
              ? "Restart now"
              : state.mobile
                ? "Download APK"
                : "Install & restart"}
          </button>
        )}
        <button
          type="button"
          className="button secondary"
          disabled={busy || state.status === "restart"}
          onClick={() => void state.checkUpdates()}
        >
          <RefreshCw size={15} className={busy ? "spin" : ""} />
          {busy ? "Please wait…" : "Check for updates"}
        </button>
      </div>
      {state.mobile && state.status === "available" && (
        <small>
          Android will ask you to confirm installation after downloading.
        </small>
      )}
    </section>
  );
}
function UpdateBanner() {
  const state = useContext(UpdatesContext);
  if (
    !state ||
    state.dismissed ||
    !["available", "installing", "restart"].includes(state.status)
  )
    return null;
  return (
    <aside className="update-banner" role="status">
      <span className="update-banner-icon">
        {state.status === "restart" ? (
          <CheckCircle2 size={23} />
        ) : (
          <ArrowUpCircle size={23} />
        )}
      </span>
      <div>
        <strong>
          {state.status === "restart"
            ? "Your update is ready"
            : state.status === "installing"
              ? "Updating your ledger…"
              : "A new version is available"}
        </strong>
        <p>
          {state.status === "installing"
            ? state.progress !== null
              ? state.progress + "% downloaded"
              : "Downloading securely…"
            : "Badminton Ledger " + state.version}
        </p>
      </div>
      <button
        type="button"
        className="button primary"
        disabled={state.status === "installing"}
        onClick={() => void state.install()}
      >
        {state.status === "restart"
          ? "Restart"
          : state.mobile
            ? "Download"
            : "Update"}
        <Download size={15} />
      </button>
      {state.status === "available" && (
        <button
          type="button"
          className="icon-button"
          aria-label="Remind me later"
          onClick={state.dismiss}
        >
          <X size={17} />
        </button>
      )}
      {state.error && (
        <span className="update-error">
          <AlertCircle size={15} />
          {state.error}
        </span>
      )}
    </aside>
  );
}
