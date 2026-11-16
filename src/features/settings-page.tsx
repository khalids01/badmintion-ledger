import { t } from "../lib/i18n";
import { LanguageControl } from "./language";
import { ThemeControl } from "./theme";
import { UpdateControl } from "./updates";
import { AdminSettings } from "./club";
import { PanelTitle } from "../components/ui-kit";
import {
  Receipt,
  ChevronRight,
  Plus,
  LogOut,
  Download,
  Smartphone,
} from "lucide-react";
import type { LedgerWorkspace } from "./use-ledger";
import type { Session } from "@supabase/supabase-js";
import type { Category } from "../lib/types";

export function SettingsPage({
  workspace,
  session,
  readOnly,
  onLogout,
  onExportTransactions,
  onExportMembers,
  onOpenCategory,
  onSeedCategories,
  onSelectMyMember,
  signOutBusy,
}: {
  workspace: LedgerWorkspace;
  session: Session;
  readOnly?: boolean;
  onLogout: () => void;
  onExportTransactions?: () => void;
  onExportMembers?: () => void;
  onOpenCategory?: (record?: Category) => void;
  onSeedCategories?: () => void;
  onSelectMyMember?: (id: string) => void;
  signOutBusy?: boolean;
}) {
  const { data, my, busy, selectMyMember } = workspace;
  return (
    <div className="settings-grid">
      {/* Profile & account */}
      <section className="panel">
        <PanelTitle
          title="Profile & account"
          subtitle="One club. One simple ledger."
        />
        <div className="settings-body">
          <label>
            {t("Account email")}
            <input readOnly value={session.user.email || t("Administrator")} />
          </label>
          <label>
            {t("Currency")}
            <input readOnly value={t("Bangladeshi Taka (BDT · ৳)")} />
          </label>
          <label>
            {t("Timezone")}
            <input readOnly value="Asia/Dhaka (UTC+06:00)" />
          </label>
          {!readOnly && onSelectMyMember && (
            <label>
              {t("My member profile")}
              <select
                value={my?.id || ""}
                disabled={busy}
                onChange={(e) => void selectMyMember(e.target.value)}
              >
                <option value="">{t("Not linked")}</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="button secondary"
            onClick={onLogout}
            disabled={signOutBusy}
          >
            <LogOut size={16} />
            {t("Sign out")}
          </button>
        </div>
      </section>

      {/* Appearance & language */}
      <section className="panel">
        <PanelTitle
          title="Appearance"
          subtitle="Language and light or dark theme."
        />
        <div className="settings-body">
          <LanguageControl />
          <ThemeControl />
        </div>
      </section>

      {/* Data & export (admin only) */}
      {!readOnly && (onExportTransactions || onExportMembers) && (
        <section className="panel">
          <PanelTitle
            title="Data & export"
            subtitle="Download your ledger as CSV."
          />
          <div className="settings-body">
            {onExportTransactions && (
              <button
                className="button secondary"
                onClick={onExportTransactions}
              >
                <Download size={16} />
                {t("Export all transactions")}
              </button>
            )}
            {onExportMembers && (
              <button className="button secondary" onClick={onExportMembers}>
                <Download size={16} />
                {t("Member balances CSV")}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Expense categories (admin only) */}
      {!readOnly && onOpenCategory && (
        <section className="panel">
          <PanelTitle
            title="Expense categories"
            subtitle="Keep your spending organized."
            right={
              <button
                className="icon-button"
                aria-label={t("Add category")}
                onClick={() => onOpenCategory()}
              >
                <Plus size={20} />
              </button>
            }
          />
          {data.expense_categories.map((c) => (
            <button
              className="category-row"
              key={c.id}
              onClick={() => onOpenCategory(c)}
            >
              <span className="tx-icon expense">
                <Receipt size={17} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {c.name}
                <small>
                  {c.is_active ? t("Active") : t("Inactive")} · {t("Order")}{" "}
                  {c.sort_order}
                </small>
              </span>
              <ChevronRight size={16} className="muted" />
            </button>
          ))}
          {!data.expense_categories.length && onSeedCategories && (
            <div className="settings-body">
              <p className="form-hint">{t("Set up default categories")}</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={onSeedCategories}
              >
                {t("Set up default categories")}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Club administration (admin only) */}
      {!readOnly && (
        <div className="span-2">
          <AdminSettings />
        </div>
      )}

      {/* Advanced */}
      <section className="panel">
        <PanelTitle title="Advanced" subtitle="Updates and device details." />
        <div className="settings-body">
          <div
            className="info-box"
            style={{ display: "flex", gap: 10, alignItems: "center" }}
          >
            <Smartphone size={18} />
            <span>
              {t("Updates are installed through the desktop or Android app.")}
            </span>
          </div>
          <UpdateControl />
        </div>
      </section>
    </div>
  );
}
