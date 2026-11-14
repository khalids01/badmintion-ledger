import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Moon, Sun, Monitor } from "lucide-react";
type Theme = "light" | "dark" | "system";
const ThemeContext = createContext<{
  theme: Theme;
  dark: boolean;
  setTheme: (v: Theme) => void;
}>({ theme: "system", dark: false, setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("ledger-theme");
      return saved === "dark" || saved === "light" ? saved : "system";
    } catch {
      return "system";
    }
  });
  const [dark, setDark] = useState(
    document.documentElement.dataset.theme === "dark",
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      setDark(document.documentElement.dataset.theme === "dark");
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute(
          "content",
          document.documentElement.dataset.theme === "dark"
            ? "#121b16"
            : "#f7f8fa",
        );
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("ledger-theme", theme);
    } catch {
      /* Storage may be unavailable in private mode. */
    }
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme, dark }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, dark } = useContext(ThemeContext);
  if (compact)
    return (
      <button
        type="button"
        className="icon-button theme-toggle"
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() =>
          setTheme(
            document.documentElement.dataset.theme === "dark"
              ? "light"
              : "dark",
          )
        }
      >
        {dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
    );
  return (
    <div className="preference-control">
      <span>Appearance</span>
      <div className="theme-options">
        {(
          [
            { value: "light", Icon: Sun },
            { value: "dark", Icon: Moon },
            { value: "system", Icon: Monitor },
          ] as const
        ).map(({ value, Icon }) => (
          <button
            type="button"
            key={value}
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
          >
            <Icon size={16} />
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
