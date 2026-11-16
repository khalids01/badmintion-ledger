import { useState } from "react";
import { Camera } from "lucide-react";
import { t } from "../lib/i18n";
import { saveElementAsPng } from "../lib/screenshot";
export function ScreenshotButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [preview, setPreview] = useState("");
  async function capture() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const target =
        document.querySelector<HTMLElement>('[role="dialog"]') ||
        document.querySelector<HTMLElement>("main");
      if (!target) throw new Error("No screen");
      const png = await saveElementAsPng(
        target,
        `badminton-ledger-${new Date().toISOString().slice(0, 10)}.png`,
      );
      setPreview(png);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="screenshot-control" data-capture-exclude="true">
      <button
        type="button"
        className={compact ? "icon-button" : "button secondary"}
        aria-label={t("Screenshot")}
        title={t("Screenshot")}
        disabled={busy}
        onClick={() => void capture()}
      >
        <Camera size={19} />
        <span className={compact ? "sr-only" : ""}>
          {t(busy ? "Capturing…" : "Screenshot")}
        </span>
      </button>
      {preview && (
        <span className="screenshot-preview">
          <img src={preview} alt={t("Screenshot preview")} />
          <a href={preview} download="badminton-ledger.png">
            {t("Download screenshot")}
          </a>
          <button
            type="button"
            className="text-button"
            onClick={() => setPreview("")}
          >
            {t("Close")}
          </button>
        </span>
      )}
      {error && (
        <small role="alert">{t("Screenshot failed. Please try again.")}</small>
      )}
    </span>
  );
}
