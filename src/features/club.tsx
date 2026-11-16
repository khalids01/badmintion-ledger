import { LanguageControl } from "./language";
import { t } from "../lib/i18n";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { ThemeControl } from "./theme";
import { UpdateControl } from "./updates";
import { day } from "../lib/accounting";

export interface Access {
  status: "active" | "pending" | "banned";
  is_admin: boolean;
  owner_id: string | null;
}
interface ClubUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  is_admin: boolean;
  approved: boolean;
  banned: boolean;
}
interface Directory {
  signup_enabled: boolean;
  users: ClubUser[];
}
export async function loadAccess(): Promise<Access> {
  const { data, error } = await supabase!.rpc("account_access");
  if (error) throw error;
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !["active", "pending", "banned"].includes(String(data.status)) ||
    typeof data.is_admin !== "boolean" ||
    (data.status === "active" && typeof data.owner_id !== "string")
  )
    throw new Error("Could not verify club access.");
  return data as unknown as Access;
}
export function AccessScreen({
  status,
  retry,
  logout,
}: {
  status: string;
  retry: () => void;
  logout: () => void;
}) {
  return (
    <div className="auth-page">
      <section className="auth-card">
        <img className="brand-icon" src="/brand.svg" alt="" />
        <h1>
          {status === "banned"
            ? t("Access suspended")
            : status === "pending"
              ? t("Waiting for approval")
              : t("Checking club access…")}
        </h1>
        <p>
          {status === "banned"
            ? t(
                "Your account is banned. Contact the club administrator to restore access.",
              )
            : status === "pending"
              ? t(
                  "Your account is ready. The administrator must approve you before you can view the club.",
                )
              : t("We need a connection to verify your membership.")}
        </p>
        <div className="form">
          <button className="button secondary" onClick={retry}>
            {t("Check again")}
          </button>
          <button className="button secondary" onClick={logout}>
            {t("Sign out")}
          </button>
          <LanguageControl />
          <ThemeControl />
          <UpdateControl />
        </div>
      </section>
    </div>
  );
}
export function AdminSettings() {
  const client = useQueryClient();
  const [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [name, setName] = useState("");
  const query = useQuery({
    queryKey: ["club-users"],
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("admin_users");
      if (error) throw error;
      return data as unknown as Directory;
    },
  });
  async function manage(action: string, target?: string, value?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase!.rpc("manage_club", {
        action,
        target,
        value,
      });
      if (error) throw error;
      setEditing(null);
      await client.invalidateQueries({ queryKey: ["club-users"] });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : String((e as { message?: string }).message || e),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel admin-settings">
      <div className="panel-heading">
        <h2>{t("Club administration")}</h2>
        <p>
          {t(
            "Approve members before they can view this club. Only you can edit the ledger.",
          )}
        </p>
      </div>
      <div className="settings-body">
        {(error || query.error) && (
          <div className="error-banner" role="alert">
            {error || query.error?.message}
            <button onClick={() => void query.refetch()}>{t("Retry")}</button>
          </div>
        )}
        {query.isPending ? (
          <p>{t("Loading accounts…")}</p>
        ) : (
          query.data && (
            <>
              <label className="signup-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={query.data.signup_enabled}
                  disabled={busy}
                  onChange={(e) =>
                    void manage("signup", undefined, String(e.target.checked))
                  }
                />
                {t("Allow new signups")}
              </label>
              <p className="form-hint">
                {query.data.signup_enabled
                  ? t(
                      "Anyone can register, but every new account needs your approval.",
                    )
                  : t(
                      "Registration is closed. Existing members can still sign in.",
                    )}
              </p>
              <label>
                {t("Find an account")}
                <input
                  type="search"
                  placeholder={t("Search name or email")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="club-users">
                {query.data.users
                  .filter((u) =>
                    `${u.name} ${u.email}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((u) => (
                    <article className="club-user" key={u.id}>
                      <div>
                        <strong>{u.name || u.email}</strong>
                        <span className="club-email">{u.email}</span>
                        <span className="badge">
                          {u.is_admin
                            ? t("Administrator")
                            : u.banned
                              ? t("Banned")
                              : u.approved
                                ? t("Club member")
                                : t("Pending approval")}
                        </span>
                        <small>
                          {t("Joined")}
                          {day(u.created_at)} ·{" "}
                          {u.confirmed
                            ? t("Email confirmed")
                            : t("Email unconfirmed")}
                        </small>
                        <small>
                          {t("Last sign-in:")}{" "}
                          {u.last_sign_in_at
                            ? day(u.last_sign_in_at)
                            : t("Never")}
                        </small>
                      </div>
                      {editing === u.id ? (
                        <form
                          className="form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void manage("rename", u.id, name);
                          }}
                        >
                          <label>
                            {t("Display name")}
                            <input
                              required
                              maxLength={100}
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                            />
                          </label>
                          <div className="club-actions">
                            <button
                              className="button secondary"
                              disabled={busy}
                            >
                              {t("Save name")}
                            </button>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setEditing(null)}
                            >
                              {t("Cancel")}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="club-actions">
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => {
                              setEditing(u.id);
                              setName(u.name);
                            }}
                          >
                            {t("Edit name")}
                          </button>
                          {!u.is_admin && (
                            <>
                              {!u.banned && (
                                <button
                                  className="button secondary"
                                  disabled={busy}
                                  onClick={() =>
                                    void manage(
                                      u.approved ? "remove" : "approve",
                                      u.id,
                                    )
                                  }
                                >
                                  {u.approved
                                    ? t("Remove from club")
                                    : t("Approve into club")}
                                </button>
                              )}
                              <button
                                className={`button ${u.banned ? "secondary" : "danger"}`}
                                disabled={busy}
                                onClick={() =>
                                  void manage(u.banned ? "unban" : "ban", u.id)
                                }
                              >
                                {u.banned ? t("Unban") : t("Ban")}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                {!query.data.users.some((u) =>
                  `${u.name} ${u.email}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ) && <p>{t("No matching accounts.")}</p>}
              </div>
              <p className="form-hint">
                {t(
                  "Removing membership returns an account to pending. A ban blocks club access immediately, including existing sessions. Unbanning restores its previous membership.",
                )}
              </p>
            </>
          )
        )}
      </div>
    </section>
  );
}
