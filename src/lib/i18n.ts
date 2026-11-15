import bangla from "./bn.json";
export type Language = "en" | "bn";
const listeners = new Set<() => void>();
let language: Language = "en";
try {
  if (localStorage.getItem("ledger-language") === "bn") language = "bn";
} catch {
  /* Storage is optional. */
}
export const getLanguage = () => language;
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function setLanguage(value: Language) {
  language = value;
  document.documentElement.lang = value;
  try {
    localStorage.setItem("ledger-language", value);
  } catch {
    /* Storage is optional. */
  }
  listeners.forEach((listener) => listener());
}
export function t(
  text: string | undefined,
  values: Record<string, string | number> = {},
) {
  const candidate = (bangla as Record<string, string>)[text || ""];
  const translated =
    language === "bn" && typeof candidate === "string" ? candidate : text || "";
  return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
    String(values[key] ?? match),
  );
}
