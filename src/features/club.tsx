import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { ThemeControl } from "./theme";
import { UpdateControl } from "./updates";
import { calculate, day, money, minor } from "../lib/accounting";
import { labels } from "../lib/labels";
import type { Ledger } from "../lib/types";

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
            ? "Access suspended"
            : status === "pending"
              ? "Waiting for approval"
              : "Checking club access…"}
        </h1>
        <p>
          {status === "banned"
            ? "Your account is banned. Contact the club administrator to restore access."
            : status === "pending"
              ? "Your account is ready. The administrator must approve you before you can view the club."
              : "We need a connection to verify your membership."}
        </p>
        <div className="form">
          <button className="button secondary" onClick={retry}>
            Check again
          </button>
          <button className="button secondary" onClick={logout}>
            Sign out
          </button>
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
        <h2>Club administration</h2>
        <p>
          Approve members before they can view this club. Only you can edit the
          ledger.
        </p>
      </div>
      <div className="settings-body">
        {(error || query.error) && (
          <div className="error-banner" role="alert">
            {error || query.error?.message}
            <button onClick={() => void query.refetch()}>Retry</button>
          </div>
        )}
        {query.isPending ? (
          <p>Loading accounts…</p>
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
                Allow new signups
              </label>
              <p className="form-hint">
                {query.data.signup_enabled
                  ? "Anyone can register, but every new account needs your approval."
                  : "Registration is closed. Existing members can still sign in."}
              </p>
              <label>
                Find an account
                <input
                  type="search"
                  placeholder="Search name or email"
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
                            ? "Administrator"
                            : u.banned
                              ? "Banned"
                              : u.approved
                                ? "Club member"
                                : "Pending approval"}
                        </span>
                        <small>
                          Joined {day(u.created_at)} ·{" "}
                          {u.confirmed
                            ? "Email confirmed"
                            : "Email unconfirmed"}
                        </small>
                        <small>
                          Last sign-in:{" "}
                          {u.last_sign_in_at ? day(u.last_sign_in_at) : "Never"}
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
                            Display name
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
                              Save name
                            </button>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setEditing(null)}
                            >
                              Cancel
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
                            Edit name
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
                                    ? "Remove from club"
                                    : "Approve into club"}
                                </button>
                              )}
                              <button
                                className={`button ${u.banned ? "secondary" : "danger"}`}
                                disabled={busy}
                                onClick={() =>
                                  void manage(u.banned ? "unban" : "ban", u.id)
                                }
                              >
                                {u.banned ? "Unban" : "Ban"}
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
                ) && <p>No matching accounts.</p>}
              </div>
              <p className="form-hint">
                Removing membership returns an account to pending. A ban blocks
                club access immediately, including existing sessions. Unbanning
                restores its previous membership.
              </p>
            </>
          )
        )}
      </div>
    </section>
  );
}
export function ClubViewer({
  data,
  logout,
}: {
  data: Ledger;
  logout: () => void;
}) {
  const totals = calculate(data);
  return (
    <div className="club-viewer">
      <header className="club-viewer-header">
        <img className="brand-icon" src="/brand.svg" alt="" />
        <strong>Badminton Ledger</strong>
        <ThemeControl compact />
        <button className="button secondary" onClick={logout}>
          Sign out
        </button>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">CLUB MEMBER</div>
            <h1>Your club’s ledger</h1>
            <p>You have view access. The administrator manages records.</p>
          </div>
        </div>
        <div className="stats-grid">
          <section className="panel settings-body">
            <span>Available Group Funds</span>
            <h2>{money(totals.funds)}</h2>
          </section>
          {[
            ["Contributions", totals.collected],
            ["Expenses", totals.expenses],
            ["Outstanding dues", totals.outstanding],
            ["Loans outstanding", totals.loans],
          ].map(([label, value]) => (
            <section className="panel settings-body" key={label}>
              <span>{label}</span>
              <h2>{money(Number(value))}</h2>
            </section>
          ))}
        </div>
        <section className="panel">
          <div className="settings-body">
            <h2>Transactions</h2>
            {data.transactions
              .filter((t) => !t.voided_at)
              .map((t) => (
                <div className="club-transaction" key={t.id}>
                  <div>
                    <strong>{t.description || labels[t.type]}</strong>
                    <small>
                      {labels[t.type]} · {day(t.transaction_date)}
                    </small>
                    <small>
                      {data.members.find(
                        (m) => m.id === (t.member_id || t.paid_by_member_id),
                      )?.name ||
                        data.expense_categories.find(
                          (c) => c.id === t.category_id,
                        )?.name}
                    </small>
                  </div>
                  <strong>{money(minor(t.amount))}</strong>
                </div>
              ))}
            {!data.transactions.some((t) => !t.voided_at) && (
              <p>No transactions yet.</p>
            )}
          </div>
        </section>
        <section className="panel settings-body">
          <h2>Club members</h2>
          {data.members
            .filter((m) => m.is_active)
            .map((m) => (
              <div className="club-transaction" key={m.id}>
                <strong>{m.name}</strong>
                <span>{money(totals.members[m.id]?.outstanding || 0)} due</span>
              </div>
            ))}
        </section>
        <section className="panel settings-body">
          <UpdateControl />
        </section>
      </main>
    </div>
  );
}
