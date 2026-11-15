import { useEffect, useSyncExternalStore } from "react";
import {
  getLanguage,
  setLanguage,
  subscribeLanguage,
  t,
  type Language,
} from "../lib/i18n";
export { t } from "../lib/i18n";
export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return language;
}
export function LanguageControl({ compact = false }: { compact?: boolean }) {
  const language = useLanguage();
  return (
    <label
      className={compact ? "language-control compact" : "language-control"}
    >
      <span className={compact ? "sr-only" : ""}>{t("Language")}</span>
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="bn" lang="bn">
          বাংলা
        </option>
      </select>
    </label>
  );
}
