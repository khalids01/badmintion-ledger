import { ScreenshotButton } from "../components/screenshot-button";
import { t } from "../lib/i18n";
import { LanguageControl } from "./language";
import { ThemeControl } from "./theme";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Settings,
  Plus,
} from "lucide-react";

export type Page = "Home" | "Members" | "Transactions" | "Reports" | "Settings";

export const navItems: [Page, typeof LayoutDashboard][] = [
  ["Home", LayoutDashboard],
  ["Members", Users],
  ["Transactions", ArrowLeftRight],
  ["Reports", ChartNoAxesCombined],
];

function TabButton({
  name,
  Icon,
  selected,
  badge,
  onNavigate,
}: {
  name: Page;
  Icon: typeof LayoutDashboard;
  selected: boolean;
  badge?: number;
  onNavigate: (page: Page) => void;
}) {
  return (
    <button
      className={selected ? "selected" : ""}
      aria-current={selected ? "page" : undefined}
      onClick={() => onNavigate(name)}
    >
      <Icon size={21} />
      <span>{t(name)}</span>
      {badge ? <b className="nav-badge">{badge}</b> : null}
    </button>
  );
}

export function AppShellNav({
  page,
  duesCount,
  onNavigate,
  onAdd,
  canAdd,
}: {
  page: Page;
  duesCount: number;
  onNavigate: (page: Page) => void;
  onAdd?: () => void;
  canAdd?: boolean;
}) {
  return (
    <>
      <nav className="desktop-nav" aria-label={t("Primary navigation")}>
        {navItems.map(([name, Icon]) => (
          <button
            key={name}
            className={page === name ? "selected" : ""}
            aria-current={page === name ? "page" : undefined}
            onClick={() => onNavigate(name)}
          >
            <Icon size={17} />
            <span>{t(name)}</span>
            {name === "Members" && duesCount > 0 && <b>{duesCount}</b>}
          </button>
        ))}
      </nav>

      <nav className="mobile-nav" aria-label={t("Primary navigation")}>
        {navItems.slice(0, 2).map(([name, Icon]) => (
          <TabButton
            key={name}
            name={name}
            Icon={Icon}
            selected={page === name}
            badge={name === "Members" ? duesCount : undefined}
            onNavigate={onNavigate}
          />
        ))}
        {canAdd && onAdd ? (
          <button
            className="fab-add"
            aria-label={t("Add")}
            onClick={onAdd}
            data-capture-exclude="true"
          >
            <Plus size={30} strokeWidth={2.4} />
          </button>
        ) : null}
        {navItems.slice(2).map(([name, Icon]) => (
          <TabButton
            key={name}
            name={name}
            Icon={Icon}
            selected={page === name}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </>
  );
}

export function DesktopAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="button primary desktop-add" onClick={onClick}>
      <Plus size={17} />
      {t("Add")}
    </button>
  );
}

export function HeaderActions({
  page,
  onNavigate,
  canGoSettings,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  canGoSettings: boolean;
}) {
  return (
    <div className="top-actions">
      <ScreenshotButton compact />
      <ThemeControl compact />
      <LanguageControl compact />
      {canGoSettings && (
        <button
          className="icon-button"
          aria-label={t("Settings")}
          aria-current={page === "Settings" ? "page" : undefined}
          onClick={() => onNavigate("Settings")}
        >
          <Settings size={21} />
        </button>
      )}
    </div>
  );
}
