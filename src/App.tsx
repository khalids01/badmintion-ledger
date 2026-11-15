import { t, t as translate, getLanguage } from "./lib/i18n";
import { weeklyActivity, type ActivityPoint } from "./lib/reporting";
import { LanguageControl, useLanguage } from "./features/language";
import { labels } from "./lib/labels";
import {
  TransactionForm,
  MemberForm,
  DuesForm,
  CategoryForm,
  VoidForm,
} from "./features/ledger-forms";
import { MemberStatement } from "./components/member-statement";
import {
  memberCashPaid,
  cashMovement,
  transactionLabel,
  transactionDateLabel,
} from "./lib/presentation";
import { Auth } from "./features/auth";
import {
  loadAccess,
  AccessScreen,
  AdminSettings,
  ClubViewer,
} from "./features/club";
import { useEffect, useState, lazy, Suspense, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  ClipboardList,
  ChartNoAxesCombined,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Search,
  Download,
  Wallet,
  Receipt,
  HandCoins,
  MoreHorizontal,
  X,
  LogOut,
  Activity,
  ArrowRight,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
const LedgerChart = lazy(() => import("./components/ledger-chart"));
import { Modal } from "./components/ui/dialog";
import { supabase } from "./lib/supabase";
import {
  calculate,
  money,
  minor,
  today,
  day,
  csvDownload,
} from "./lib/accounting";
import { empty, categoryNames } from "./lib/ledger-defaults";
import { ThemeControl } from "./features/theme";
import { UpdateControl } from "./features/updates";
import type { TablesInsert } from "./lib/database.types";
import type { Ledger, Kind, Transaction, Member, Category } from "./lib/types";
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Transactions", ArrowLeftRight],
  ["Members", Users],
  ["Dues", ClipboardList],
  ["Reports", ChartNoAxesCombined],
  ["Settings", Settings],
] as const;
const icons = {
  contribution: ArrowDownLeft,
  expense: ArrowUpRight,
  loan_received: HandCoins,
  loan_repayment: ArrowUpRight,
};
type Edit =
  | {
      kind: "transaction";
      type: Kind;
      record?: Transaction;
      personal?: boolean;
    }
  | { kind: "start" }
  | { kind: "cash" }
  | { kind: "loans" }
  | { kind: "member"; record?: Member }
  | { kind: "dues" }
  | { kind: "category"; record?: Category }
  | { kind: "details"; member: Member }
  | { kind: "void"; record: Transaction }
  | null;
async function insertRecord(
  table: keyof Ledger,
  payload: Record<string, unknown>,
) {
  switch (table) {
    case "members":
      return supabase!
        .from("members")
        .insert(payload as TablesInsert<"members">);
    case "transactions":
      return supabase!
        .from("transactions")
        .insert(payload as TablesInsert<"transactions">);
    case "dues":
      return supabase!.from("dues").insert(payload as TablesInsert<"dues">);
    case "expense_categories":
      return supabase!
        .from("expense_categories")
        .insert(payload as TablesInsert<"expense_categories">);
  }
}
function App() {
  useLanguage();
  const [page, setPage] = useState("Dashboard"),
    [chartWeeks, setChartWeeks] = useState(2),
    [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(!supabase),
    [recovering, setRecovering] = useState(
      window.location.hash.includes("type=recovery"),
    ),
    [edit, setEdit] = useState<Edit>(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [memberFilter, setMemberFilter] = useState(""),
    [categoryFilter, setCategoryFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [memberView, setMemberView] = useState("active");
  const client = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setToast(error.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, value) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(value);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const access = useQuery({
    queryKey: ["account-access", session?.user.id],
    enabled: !!session,
    queryFn: loadAccess,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
    retry: 1,
  });
  useEffect(() => {
    if (access.data?.status !== "active" || access.isError) {
      void client
        .cancelQueries({ queryKey: ["ledger"] })
        .then(() => client.removeQueries({ queryKey: ["ledger"] }));
      setEdit(null);
    }
  }, [access.data?.status, access.isError, client]);
  async function logout() {
    await supabase!.auth.signOut({ scope: "local" });
    client.clear();
    setSession(null);
  }
  const query = useQuery({
    queryKey: ["ledger", session?.user.id],
    enabled: !!session && access.data?.status === "active" && !access.isError,
    queryFn: async () => {
      const result = await Promise.all([
        supabase!.from("members").select("*").order("name"),
        supabase!.from("expense_categories").select("*").order("sort_order"),
        supabase!.from("dues").select("*"),
        supabase!
          .from("transactions")
          .select("*")
          .order("transaction_date", { ascending: false }),
      ]);
      for (const r of result) if (r.error) throw r.error;
      return {
        members: result[0].data!,
        expense_categories: result[1].data!,
        dues: result[2].data!,
        transactions: result[3].data!,
      } as Ledger;
    },
  });
  const data = query.data || empty,
    totals = calculate(data),
    cash = cashMovement(data.transactions),
    my = data.members.find((m) => m.is_me),
    active = data.members.filter((m) => m.is_active);
  const notify = (e: unknown) =>
    setToast(
      e instanceof Error
        ? e.message
        : String((e as { message?: string })?.message || e),
    );
  async function save(
    table: keyof Ledger,
    values: Record<string, unknown> | Record<string, unknown>[],
    id?: string,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      if (!online)
        throw new Error(
          "You are offline. Reconnect and try again. Your form is preserved.",
        );
      const result = Array.isArray(values)
        ? await supabase!
            .from("transactions")
            .insert(
              values.map((row) => ({
                ...row,
                owner_id: session!.user.id,
              })) as TablesInsert<"transactions">[],
            )
        : id
          ? await supabase!
              .from(table)
              .update({ ...values, owner_id: session!.user.id })
              .eq("id", id)
          : await insertRecord(table, {
              ...values,
              owner_id: session!.user.id,
            });
      if (result.error) throw result.error;
      await client.invalidateQueries({ queryKey: ["ledger"] });
      setEdit(null);
      setToast("Saved successfully");
    } catch (e) {
      notify(e);
    } finally {
      setBusy(false);
    }
  }
  async function selectMyMember(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      if (!online) throw new Error("You are offline. Reconnect and try again.");
      for (const member of data.members.filter((m) => m.is_me && m.id !== id)) {
        const result = await supabase!
          .from("members")
          .update({ is_me: false })
          .eq("id", member.id);
        if (result.error) throw result.error;
      }
      if (id) {
        const result = await supabase!
          .from("members")
          .update({ is_me: true })
          .eq("id", id);
        if (result.error) throw result.error;
      }
      setToast("Saved successfully");
    } catch (e) {
      notify(e);
    } finally {
      await client.invalidateQueries({ queryKey: ["ledger"] });
      setBusy(false);
    }
  }
  async function assign(rows: Record<string, unknown>[]) {
    if (!rows.length) return;
    setBusy(true);
    try {
      if (!online) throw new Error("You are offline. Reconnect and try again.");
      const { error } = await supabase!.from("dues").insert(
        rows.map((r) => ({
          ...r,
          owner_id: session!.user.id,
        })) as TablesInsert<"dues">[],
      );
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ["ledger"] });
      setEdit(null);
      setToast("Dues assigned");
    } catch (e) {
      notify(e);
    } finally {
      setBusy(false);
    }
  }
  function exportTransactions() {
    try {
      csvDownload(
        "badminton-transactions.csv",
        (page === "Settings" ? data.transactions : filtered).map((t) => ({
          ...t,
          member: data.members.find(
            (m) => m.id === (t.member_id || t.paid_by_member_id),
          )?.name,
          category: data.expense_categories.find((c) => c.id === t.category_id)
            ?.name,
        })),
      );
    } catch (e) {
      notify(e);
    }
  }
  const filtered = data.transactions.filter(
    (t) =>
      (filter === "all" || t.type === filter) &&
      (!memberFilter ||
        t.member_id === memberFilter ||
        t.paid_by_member_id === memberFilter) &&
      (!categoryFilter || t.category_id === categoryFilter) &&
      (!from || t.transaction_date.slice(0, 10) >= from) &&
      (!to || t.transaction_date.slice(0, 10) <= to) &&
      (t.description || "").toLowerCase().includes(search.toLowerCase()),
  );
  const monthlyStart = new Date(
    (from || (to || today()).slice(0, 7) + "-01") + "T12:00:00+06:00",
  );
  monthlyStart.setDate(1);
  if (!from) monthlyStart.setMonth(monthlyStart.getMonth() - 5);
  const monthlyEnd = new Date((to || today()) + "T12:00:00+06:00");
  const monthCount = Math.max(
    1,
    (monthlyEnd.getFullYear() - monthlyStart.getFullYear()) * 12 +
      monthlyEnd.getMonth() -
      monthlyStart.getMonth() +
      1,
  );
  const monthly = Array.from({ length: Math.min(monthCount, 120) }, (_, i) => {
    const d = new Date(monthlyStart);
    d.setMonth(d.getMonth() + i);
    const key =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const rows = filtered.filter((t) => t.transaction_date.slice(0, 7) === key);
    const result = calculate({ ...data, transactions: rows, dues: [] });
    return {
      label: d.toLocaleString(getLanguage() === "bn" ? "bn-BD" : "en", {
        month: "short",
        year: monthCount > 12 ? "2-digit" : undefined,
      }),
      Contributions: result.collected / 100,
      Expenses: result.expenses / 100,
    };
  });
  const weekly = weeklyActivity(data, chartWeeks);
  const pending = data.members
    .filter((m) => totals.members[m.id].outstanding > 0)
    .sort(
      (a, b) =>
        totals.members[b.id].outstanding - totals.members[a.id].outstanding,
    );
  const go = (p: string) => {
    setPage(p);
    setSearch("");
    setFilter("all");
    setFrom("");
    setTo("");
    setCategoryFilter("");
    setMemberFilter("");
  };
  function TxList({ rows }: { rows: Transaction[] }) {
    return rows.length ? (
      <div className="tx-list">
        {rows.map((t) => {
          const Icon = icons[t.type];
          const member = data.members.find(
            (m) => m.id === (t.member_id || t.paid_by_member_id),
          );
          return (
            <button
              className={"tx-row " + (t.voided_at ? "voided" : "")}
              key={t.id}
              onClick={() =>
                setEdit({ kind: "transaction", type: t.type, record: t })
              }
            >
              <span className={"tx-icon " + t.type}>
                <Icon size={19} />
              </span>
              <span className="tx-main">
                <strong>{t.description || translate(labels[t.type])}</strong>
                <small>
                  <span className="tx-mobile-type">
                    {transactionLabel(t)} ·{" "}
                  </span>
                  {member?.name ||
                    data.expense_categories.find((c) => c.id === t.category_id)
                      ?.name ||
                    translate("Group funds")}{" "}
                  <span>· {transactionDateLabel(t)}</span>
                </small>
              </span>
              <span className="tx-type">{transactionLabel(t)}</span>
              <span className={"tx-amount " + t.type}>
                {t.funding_source === "member_personal"
                  ? ""
                  : t.type === "contribution" || t.type === "loan_received"
                    ? "+"
                    : "−"}
                {money(minor(t.amount))}
                <small>
                  {t.voided_at
                    ? translate("Voided")
                    : t.funding_source === "member_personal"
                      ? t.personal_settlement === "contribution"
                        ? translate("Fees credited · no cash moved")
                        : translate("Loan added · no cash moved")
                      : translate(
                          {
                            cash: "Cash",
                            bank_transfer: "Bank transfer",
                            mobile_wallet: "Mobile wallet",
                            other: "Other",
                          }[t.payment_method || ""] || "",
                        )}
                </small>
              </span>
              <ChevronRight size={15} className="muted" />
            </button>
          );
        })}
      </div>
    ) : (
      <Empty
        title={translate("No transactions yet")}
        text={translate("Your financial history starts with the first entry.")}
      />
    );
  }
  if (!supabase)
    return (
      <div className="auth-page">
        <section className="auth-card">
          <h1>{t("Connection not configured")}</h1>
          <p>
            {t("Set the Supabase URL and publishable key to use your ledger.")}
          </p>
        </section>
      </div>
    );
  if (!authReady)
    return <div className="loading">{t("Opening your ledger…")}</div>;
  if (recovering)
    return (
      <Auth
        resetMode
        onRecovered={() => {
          setRecovering(false);
          window.location.hash = "";
        }}
      />
    );
  if (!session) return <Auth />;
  if (!access.data || access.isError || access.data.status !== "active")
    return (
      <AccessScreen
        status={access.isError ? "error" : access.data?.status || "loading"}
        retry={() => void access.refetch()}
        logout={() => void logout()}
      />
    );
  if (!access.data.is_admin) {
    if (query.isPending)
      return <div className="loading">{t("Loading your club…")}</div>;
    if (query.isError)
      return (
        <AccessScreen
          status="error"
          retry={() => void query.refetch()}
          logout={() => void logout()}
        />
      );
    return <ClubViewer data={data} logout={() => void logout()} />;
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Dashboard");
          }}
        >
          <img className="brand-icon" src="/brand.svg" alt="" />
          <span>
            Badminton<span className="brand-light">Ledger</span>
          </span>
        </a>
        <div className="workspace">
          <span className="club-logo">B</span>
          <div>
            <strong>{t("Our badminton club")}</strong>
            <small>{t("Club ledger")}</small>
          </div>
          <MoreHorizontal size={17} />
        </div>
        <div className="nav-caption">{t("WORKSPACE")}</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "nav-item selected" : "nav-item"}
              onClick={() => go(name)}
            >
              <Icon size={19} />
              <span>{t(name)}</span>
              {name === "Dues" && pending.length > 0 && <b>{pending.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" onClick={() => go("Settings")}>
            <span className="avatar">{my?.name.slice(0, 1) || "A"}</span>
            <span>
              <strong>{my?.name || t("Administrator")}</strong>
              <small>{t("Club administrator")}</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="mobile-brand">
            <img src="/brand.svg" alt="Badminton Ledger" />
            <strong>Badminton Ledger</strong>
          </span>
          <span className="breadcrumb">
            {t("Workspace")}
            <ChevronRight size={14} /> <strong>{t(page)}</strong>
          </span>
          <span className="top-right">
            <span className="sync">
              <span className={"status-dot " + (!online ? "offline" : "")} />
              {online ? t("Connected") : t("Offline")}
            </span>
            <LanguageControl compact />
            <ThemeControl compact />
            <span className="avatar small">{my?.name.slice(0, 1) || "A"}</span>
          </span>
        </header>
        <main>
          {!online && (
            <div className="error-banner">
              {t("You’re offline. Reconnect to save changes.")}
            </div>
          )}
          {query.isError && (
            <div className="error-banner">
              {t("Could not load your ledger:")}
              {query.error.message}
              <button onClick={() => query.refetch()}>{t("Retry")}</button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">{t("YOUR CLUB, IN BALANCE")}</div>
              <h1>{t(page)}</h1>
            </div>
            <div className="heading-actions">
              {page === "Dashboard" ? (
                <span className="date-label">
                  <CalendarDays size={16} />
                  {day(today() + "T12:00:00+06:00")}
                </span>
              ) : (
                <button
                  className="button secondary"
                  onClick={exportTransactions}
                >
                  <Download size={16} />
                  {t("Export CSV")}
                </button>
              )}
              <button
                className="button primary"
                onClick={() =>
                  setEdit(
                    page === "Members"
                      ? { kind: "member" }
                      : page === "Dues"
                        ? { kind: "dues" }
                        : { kind: "start" },
                  )
                }
              >
                <Plus size={17} />
                {page === "Members"
                  ? t("Add member")
                  : page === "Dues"
                    ? t("Assign dues")
                    : t("Add transaction")}
              </button>
            </div>
          </div>
          {!query.isLoading && data.members.length === 0 && (
            <div className="onboarding panel">
              <ShieldCheck size={25} />
              <div>
                <h3>{t("Welcome to your club’s ledger.")}</h3>
                <p>{t("Add members to start your ledger.")}</p>
              </div>
              <button
                className="button primary"
                onClick={() => setEdit({ kind: "member" })}
              >
                {t("Add your first member")}
                <Plus size={16} />
              </button>
            </div>
          )}
          {query.isLoading ? (
            <div className="panel loading">{t("Loading your ledger…")}</div>
          ) : (
            <>
              {page === "Dashboard" && (
                <>
                  <div className="stats-grid balance-cards">
                    <button
                      className="stat featured"
                      onClick={() => setEdit({ kind: "cash" })}
                    >
                      <div className="stat-label">
                        {t("Cash in hand")}
                        <Wallet size={18} />
                      </div>
                      <div className="stat-value">{money(totals.funds)}</div>
                      <div className="stat-footer">
                        {t("Available cash")}
                        <ChevronRight size={15} />
                      </div>
                    </button>
                    {[
                      {
                        name: t("Members still owe"),
                        value: totals.outstanding,
                        icon: Users,
                        detail: t("{count} members", { count: pending.length }),
                        action: () => go("Dues"),
                      },
                      {
                        name: t("Club must repay"),
                        value: totals.loans,
                        icon: HandCoins,
                        detail: t("Member loans"),
                        action: () => setEdit({ kind: "loans" }),
                      },
                      {
                        name: t("Total spent"),
                        value: totals.expenses,
                        icon: Receipt,
                        detail: t("All spending"),
                        action: () => {
                          go("Transactions");
                          setFilter("expense");
                        },
                      },
                    ].map((s) => (
                      <button className="stat" key={s.name} onClick={s.action}>
                        <div className="stat-label">
                          {t(s.name)}
                          <s.icon size={18} />
                        </div>
                        <div className="stat-value">{money(s.value)}</div>
                        <div className="stat-footer">
                          {t(s.detail)}
                          <ChevronRight size={15} />
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="quick-actions">
                    <span>{t("QUICK ADD")}</span>
                    {(
                      [
                        "contribution",
                        "expense",
                        "loan_received",
                        "loan_repayment",
                      ] as Kind[]
                    ).map((type) => {
                      const Icon = icons[type];
                      return (
                        <button
                          key={type}
                          onClick={() => setEdit({ kind: "transaction", type })}
                        >
                          <span className={"quick-icon " + type}>
                            <Icon size={16} />
                          </span>
                          {t(
                            {
                              contribution: "Someone paid money",
                              expense: "Club bought something",
                              loan_received: "Member lent money",
                              loan_repayment: "Repay a member",
                            }[type],
                          )}
                          <Plus size={14} />
                        </button>
                      );
                    })}
                    <button
                      onClick={() =>
                        setEdit({
                          kind: "transaction",
                          type: "expense",
                          personal: true,
                        })
                      }
                    >
                      <span className="quick-icon expense">
                        <Receipt size={16} />
                      </span>
                      {t("Someone provided items")}
                      <Plus size={14} />
                    </button>
                    <button onClick={() => setEdit({ kind: "dues" })}>
                      <span className="quick-icon dues">
                        <ClipboardList size={16} />
                      </span>
                      {t("Assign dues")}
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="dashboard-columns">
                    <section className="panel chart-panel">
                      <PanelTitle
                        title={t("Cash in, cash out")}
                        subtitle={t(
                          "Weekly cash received and spent · Monday–Sunday",
                        )}
                        right={
                          <select
                            className="period chart-period"
                            aria-label="Chart weeks"
                            value={chartWeeks}
                            onChange={(e) =>
                              setChartWeeks(Number(e.target.value))
                            }
                          >
                            {[2, 4, 8, 12].map((n) => (
                              <option key={n} value={n}>
                                {t("Last {count} weeks", { count: n })}
                              </option>
                            ))}
                          </select>
                        }
                      />
                      <div className="chart-legend">
                        <span>
                          <i className="green-bg" />
                          {t("Cash received (fees + loans)")}
                        </span>
                        <span>
                          <i className="orange-bg" />
                          {t("Cash spent / repaid")}
                        </span>
                      </div>
                      <Chart data={weekly} cash />
                    </section>
                    <section className="panel dues-panel">
                      <PanelTitle
                        title={t("Who still needs to pay?")}
                        subtitle={t(
                          "Unpaid entry and weekly fees. Loans are separate.",
                        )}
                        right={
                          <span className="count-pill">
                            {t("{count} members", { count: pending.length })}
                          </span>
                        }
                      />
                      {pending.slice(0, 4).map((m, i) => (
                        <button
                          className="due-row"
                          key={m.id}
                          onClick={() =>
                            setEdit({ kind: "details", member: m })
                          }
                        >
                          <span className={"avatar color-" + i}>
                            {m.name
                              .split(" ")
                              .map((x) => x[0])
                              .join("")}
                          </span>
                          <span>
                            <strong>{m.name}</strong>
                            <small>
                              {Math.round(
                                (totals.members[m.id].credit /
                                  Math.max(1, totals.members[m.id].assigned)) *
                                  100,
                              )}
                              {t("% paid")}
                            </small>
                          </span>
                          <strong>
                            {money(totals.members[m.id].outstanding)}
                          </strong>
                        </button>
                      ))}
                      {!pending.length && (
                        <Empty
                          title={t("All caught up")}
                          text={t("No outstanding member dues.")}
                        />
                      )}
                      <button className="panel-link" onClick={() => go("Dues")}>
                        {t("View all dues")}
                        <ArrowRight size={15} />
                      </button>
                    </section>
                  </div>
                  <div className="dashboard-columns bottom">
                    <section className="panel">
                      <PanelTitle
                        title={t("Recent transactions")}
                        subtitle={t("The latest from your ledger.")}
                        right={
                          <button
                            className="text-button"
                            onClick={() => go("Transactions")}
                          >
                            {t("View all")}
                            <ArrowRight size={14} />
                          </button>
                        }
                      />
                      <TxList
                        rows={[...data.transactions]
                          .sort(
                            (a, b) =>
                              Date.parse(b.transaction_date) -
                                Date.parse(a.transaction_date) ||
                              Date.parse(b.created_at) -
                                Date.parse(a.created_at),
                          )
                          .slice(0, 4)}
                      />
                    </section>
                    <section className="panel member-payments">
                      <PanelTitle
                        title={t("Member payments")}
                        subtitle=""
                        right={
                          <button
                            className="text-button"
                            onClick={() => go("Members")}
                          >
                            {t("View all")}
                          </button>
                        }
                      />
                      {active.map((m) => (
                        <button
                          className="member-payment-row"
                          key={m.id}
                          onClick={() =>
                            setEdit({ kind: "details", member: m })
                          }
                        >
                          <span className="avatar">{m.name[0]}</span>
                          <span>
                            <strong>{m.name}</strong>
                            <small>{t("Total paid")}</small>
                          </span>
                          <strong>
                            {money(
                              memberCashPaid(data, m.id) +
                                totals.members[m.id].purchases,
                            )}
                          </strong>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </section>
                  </div>
                </>
              )}
              {page === "Transactions" && (
                <section className="panel">
                  <div className="filters">
                    <label className="search">
                      <Search size={17} />
                      <input
                        placeholder={t("Search transactions…")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label={t("Transaction type")}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">{t("All transactions")}</option>
                      {Object.entries(labels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {t(v)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={t("Member filter")}
                      value={memberFilter}
                      onChange={(e) => setMemberFilter(e.target.value)}
                    >
                      <option value="">{t("All members")}</option>
                      {data.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={t("Category filter")}
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="">{t("All categories")}</option>
                      {data.expense_categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <DateFilters {...{ from, to, setFrom, setTo }} />
                  </div>
                  <TxList rows={filtered} />
                </section>
              )}
              {page === "Members" && (
                <>
                  <div className="section-tabs">
                    <button
                      className={memberView === "active" ? "active" : ""}
                      onClick={() => setMemberView("active")}
                    >
                      {t("Active members")}
                      <span>{active.length}</span>
                    </button>
                    <button
                      className={memberView === "archived" ? "active" : ""}
                      onClick={() => setMemberView("archived")}
                    >
                      {t("Archived")}
                    </button>
                  </div>
                  <div className="member-grid">
                    {data.members
                      .filter((m) => m.is_active === (memberView === "active"))
                      .map((m, i) => {
                        const b = totals.members[m.id];
                        return (
                          <section className="panel member-card" key={m.id}>
                            <div className="member-card-top">
                              <span className={"avatar large color-" + (i % 4)}>
                                {m.name
                                  .split(" ")
                                  .map((s) => s[0])
                                  .join("")}
                              </span>
                              <button
                                className="icon-button"
                                aria-label={t("Edit {name}", { name: m.name })}
                                onClick={() =>
                                  setEdit({ kind: "member", record: m })
                                }
                              >
                                <MoreHorizontal size={21} />
                              </button>
                            </div>
                            <button
                              className="member-name"
                              onClick={() =>
                                setEdit({ kind: "details", member: m })
                              }
                            >
                              <h3>{m.name}</h3>
                            </button>
                            <p>{m.phone || t("Club member")}</p>
                            <button
                              className="member-total"
                              onClick={() =>
                                setEdit({ kind: "details", member: m })
                              }
                            >
                              <span>{t("Total paid")}</span>
                              <strong>
                                {money(
                                  memberCashPaid(data, m.id) + b.purchases,
                                )}
                              </strong>
                            </button>
                            <dl>
                              <div>
                                <dt>{t("Cash given")}</dt>
                                <dd>{money(memberCashPaid(data, m.id))}</dd>
                              </div>
                              <div>
                                <dt>{t("Spent personally")}</dt>
                                <dd>{money(b.purchases)}</dd>
                              </div>
                              <div>
                                <dt>{t("Still due")}</dt>
                                <dd className={b.outstanding ? "orange" : ""}>
                                  {money(b.outstanding)}
                                </dd>
                              </div>
                              {b.loans > 0 && (
                                <div>
                                  <dt>{t("Club owes member")}</dt>
                                  <dd>{money(b.loans)}</dd>
                                </div>
                              )}
                            </dl>
                            <button
                              className="panel-link"
                              onClick={() =>
                                setEdit({ kind: "details", member: m })
                              }
                            >
                              {t("View payments")}
                              <ArrowRight size={15} />
                            </button>
                          </section>
                        );
                      })}
                  </div>
                  {!data.members.length && (
                    <Empty
                      title={t("Who’s playing?")}
                      text={t(
                        "Add your first member to start tracking contributions.",
                      )}
                    />
                  )}
                </>
              )}
              {page === "Dues" && (
                <>
                  <div className="mini-stats">
                    <div className="panel">
                      <small>{t("Total fees charged")}</small>
                      <h2>
                        {money(
                          Object.values(totals.members).reduce(
                            (s, m) => s + m.assigned,
                            0,
                          ),
                        )}
                      </h2>
                    </div>
                    <div className="panel">
                      <small>{t("Still due")}</small>
                      <h2>{money(totals.outstanding)}</h2>
                    </div>
                    <div className="panel">
                      <small>{t("Members fully paid")}</small>
                      <h2>
                        {
                          data.members.filter(
                            (m) =>
                              totals.members[m.id].assigned > 0 &&
                              totals.members[m.id].outstanding === 0,
                          ).length
                        }
                      </h2>
                    </div>
                  </div>
                  <section className="panel">
                    <PanelTitle
                      title={t("Member balances")}
                      subtitle={t(
                        "Cash fee payments and items credited toward fees reduce these balances. Loans do not.",
                      )}
                    />
                    {data.members.map((m, i) => {
                      const b = totals.members[m.id];
                      return (
                        <button
                          className="balance-row"
                          key={m.id}
                          onClick={() =>
                            setEdit({ kind: "details", member: m })
                          }
                        >
                          <span className={"avatar color-" + (i % 4)}>
                            {m.name[0]}
                          </span>
                          <strong>{m.name}</strong>
                          <span
                            className={
                              "badge " +
                              (!b.assigned
                                ? "neutral"
                                : !b.outstanding
                                  ? "paid"
                                  : b.credit
                                    ? "partial"
                                    : "unpaid")
                            }
                          >
                            {!b.assigned
                              ? t("No dues")
                              : !b.outstanding
                                ? t("Paid")
                                : b.credit
                                  ? t("Partially paid")
                                  : t("Unpaid")}
                          </span>
                          <span>
                            {money(b.outstanding)}
                            <small>
                              {t("of")} {money(b.assigned)}
                            </small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      );
                    })}
                  </section>
                  <section className="panel assigned">
                    <PanelTitle
                      title={t("Expected payment")}
                      subtitle={t(
                        "Entry fees and weekly periods charged to each member.",
                      )}
                    />
                    {data.dues
                      .filter((d) => !d.voided_at)
                      .map((d) => (
                        <div className="assigned-row" key={d.id}>
                          <span>
                            <strong>{d.title}</strong>
                            <small>
                              {
                                data.members.find((m) => m.id === d.member_id)
                                  ?.name
                              }{" "}
                              ·{" "}
                              {d.due_date
                                ? day(d.due_date + "T12:00:00+06:00")
                                : t("No due date")}
                            </small>
                          </span>
                          <strong>{money(minor(d.amount))}</strong>
                        </div>
                      ))}
                  </section>
                </>
              )}
              {page === "Reports" && (
                <>
                  <div className="report-toolbar">
                    <DateFilters {...{ from, to, setFrom, setTo }} />
                    <button
                      className="button secondary"
                      onClick={() => {
                        try {
                          csvDownload(
                            "badminton-member-report.csv",
                            data.members.map((m) => ({
                              member: m.name,
                              ...Object.fromEntries(
                                Object.entries(totals.members[m.id]).map(
                                  ([k, v]) => [k, (v / 100).toFixed(2)],
                                ),
                              ),
                            })),
                          );
                        } catch (e) {
                          notify(e);
                        }
                      }}
                    >
                      <Download size={16} />
                      {t("Member balances CSV")}
                    </button>
                  </div>
                  <div className="dashboard-columns">
                    <section className="panel chart-panel">
                      <PanelTitle
                        title={t("Monthly fees received & spending")}
                        subtitle={t("BDT · non-voided transactions")}
                      />
                      <Chart data={monthly} />
                    </section>
                    <section className="panel">
                      <PanelTitle
                        title={t("Expenses by category")}
                        subtitle={t("All funding sources included")}
                      />
                      {data.expense_categories.map((c) => {
                        const value = data.transactions
                          .filter(
                            (t) =>
                              !t.voided_at &&
                              t.type === "expense" &&
                              t.category_id === c.id &&
                              (!from ||
                                t.transaction_date.slice(0, 10) >= from) &&
                              (!to || t.transaction_date.slice(0, 10) <= to),
                          )
                          .reduce((s, t) => s + minor(t.amount), 0);
                        return (
                          <div className="category-report" key={c.id}>
                            <span>{c.name}</span>
                            <strong>{money(value)}</strong>
                            <div>
                              <i
                                style={{
                                  width:
                                    Math.min(
                                      100,
                                      (value / Math.max(1, totals.expenses)) *
                                        100,
                                    ) + "%",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  </div>
                  <section className="panel assigned">
                    <PanelTitle
                      title={t("Fee payments by member")}
                      subtitle={t(
                        "Cash and member-funded purchases counted toward fees · selected period",
                      )}
                    />
                    {data.members.map((m) => {
                      const txs = filtered.filter(
                        (t) =>
                          !t.voided_at &&
                          (t.member_id === m.id ||
                            t.paid_by_member_id === m.id),
                      );
                      const credit = calculate({
                        ...data,
                        transactions: txs,
                        dues: [],
                      }).members[m.id].credit;
                      return (
                        <div className="assigned-row" key={m.id}>
                          <span>{m.name}</span>
                          <strong>{money(credit)}</strong>
                        </div>
                      );
                    })}
                  </section>
                  <section className="panel assigned">
                    <PanelTitle
                      title={t("Cash balance history")}
                      subtitle={t(
                        "Cash received minus cash spent / repaid · member-funded purchases excluded",
                      )}
                    />
                    {(() => {
                      let running = 0;
                      const rows = [...data.transactions]
                        .filter((t) => !t.voided_at)
                        .sort(
                          (a, b) =>
                            Date.parse(a.transaction_date) -
                              Date.parse(b.transaction_date) ||
                            Date.parse(a.created_at) - Date.parse(b.created_at),
                        )
                        .map((t) => {
                          const effect = calculate({
                            ...data,
                            transactions: [t],
                            dues: [],
                          }).funds;
                          running += effect;
                          return { t, running, effect };
                        })
                        .filter(
                          ({ t }) =>
                            (!from ||
                              t.transaction_date.slice(0, 10) >= from) &&
                            (!to || t.transaction_date.slice(0, 10) <= to),
                        );
                      return rows.reverse().map(({ t, running, effect }) => (
                        <div className="assigned-row" key={t.id}>
                          <span>
                            <strong>
                              {t.description || translate(labels[t.type])}
                            </strong>
                            <small>
                              {day(t.transaction_date)} ·{" "}
                              {effect < 0 ? "−" : "+"}
                              {money(Math.abs(effect))}
                            </small>
                          </span>
                          <strong>{money(running)}</strong>
                        </div>
                      ));
                    })()}
                  </section>
                  <section className="panel assigned">
                    <PanelTitle
                      title={t("Money the club owes back")}
                      subtitle={t(
                        "Balances include all prior activity; date filters limit displayed transactions.",
                      )}
                    />
                    <div className="report-summary">
                      <span>
                        {t("Cash in hand")}
                        <strong>{money(totals.funds)}</strong>
                      </span>
                      <span>
                        {t("Club must repay")}
                        <strong>{money(totals.loans)}</strong>
                      </span>
                      {my && (
                        <span>
                          {t("Club owes you")}{" "}
                          <strong>{money(totals.members[my.id].loans)}</strong>
                        </span>
                      )}
                    </div>
                    <TxList rows={filtered} />
                  </section>
                </>
              )}
              {page === "Settings" && (
                <div className="settings-grid">
                  <AdminSettings />
                  <section className="panel">
                    <PanelTitle
                      title={t("Your account")}
                      subtitle={t("One club. One simple ledger.")}
                    />
                    <div className="settings-body">
                      <label>
                        {t("Account email")}
                        <input
                          readOnly
                          value={session.user.email || "Administrator"}
                        />
                      </label>
                      <label>
                        {t("Currency")}
                        <input
                          readOnly
                          value={t("Bangladeshi Taka (BDT · ৳)")}
                        />
                      </label>
                      <label>
                        {t("Timezone")}
                        <input readOnly value="Asia/Dhaka (UTC+06:00)" />
                      </label>
                      <button
                        className="button secondary"
                        onClick={exportTransactions}
                      >
                        <Download size={16} />
                        {t("Export all transactions")}
                      </button>
                      {session && (
                        <button
                          className="button danger"
                          onClick={async () => {
                            await supabase!.auth.signOut();
                            client.clear();
                            setSession(null);
                          }}
                        >
                          <LogOut size={16} />
                          {t("Log out")}
                        </button>
                      )}
                      <LanguageControl />
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
                      <ThemeControl />
                      <UpdateControl />
                    </div>
                  </section>
                  <section className="panel">
                    <PanelTitle
                      title={t("Expense categories")}
                      subtitle={t("Keep your spending organized.")}
                      right={
                        <button
                          className="icon-button"
                          aria-label={t("Add category")}
                          onClick={() => setEdit({ kind: "category" })}
                        >
                          <Plus size={20} />
                        </button>
                      }
                    />
                    {data.expense_categories.map((c) => (
                      <button
                        className="category-row"
                        key={c.id}
                        onClick={() => setEdit({ kind: "category", record: c })}
                      >
                        <span className="tx-icon expense">
                          <Receipt size={17} />
                        </span>
                        <span>
                          {c.name}
                          <small>
                            {c.is_active ? t("Active") : t("Inactive")} ·{" "}
                            {t("Order")} {c.sort_order}
                          </small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                    {!data.expense_categories.length && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const { error } = await supabase!
                              .from("expense_categories")
                              .insert(
                                categoryNames.map((name, i) => ({
                                  owner_id: session!.user.id,
                                  name,
                                  sort_order: i,
                                  is_active: true,
                                })),
                              );
                            if (error) throw error;
                            await client.invalidateQueries({
                              queryKey: ["ledger"],
                            });
                            setToast("Default categories created");
                          } catch (e) {
                            notify(e);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {t("Set up default categories")}
                      </button>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </main>
        <nav className="mobile-nav">
          {nav.slice(0, 5).map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "selected" : ""}
              onClick={() => go(name)}
            >
              <Icon size={21} />
              <span>{t(name)}</span>
            </button>
          ))}
          <button
            aria-label={t("Settings")}
            className={page === "Settings" ? "selected" : ""}
            onClick={() => go("Settings")}
          >
            <Settings size={21} />
            <span>{t("Settings")}</span>
          </button>
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Activity size={17} />
          {t(toast)}
          <button
            aria-label={t("Dismiss notification")}
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {edit && (
        <Modal
          title={
            edit.kind === "start"
              ? t("What happened?")
              : edit.kind === "cash"
                ? t("Where is the club’s cash?")
                : edit.kind === "loans"
                  ? t("Who must the club repay?")
                  : edit.kind === "transaction"
                    ? edit.record
                      ? t("Transaction details")
                      : t(labels[edit.type])
                    : edit.kind === "member"
                      ? edit.record
                        ? t("Edit member")
                        : t("Add a member")
                      : edit.kind === "dues"
                        ? t("Assign dues")
                        : edit.kind === "category"
                          ? t("Expense category")
                          : edit.kind === "void"
                            ? t("Void transaction")
                            : edit.member.name
          }
          onClose={() => !busy && setEdit(null)}
        >
          {edit.kind === "start" ? (
            <div className="entry-choices">
              {[
                {
                  title: t("Someone paid money"),
                  detail: t("A member paid entry or weekly fees."),
                  type: "contribution" as Kind,
                },
                {
                  title: t("The club bought something"),
                  detail: t("An expense paid from club cash."),
                  type: "expense" as Kind,
                },
                {
                  title: t("Someone provided items"),
                  detail: t("Items or a purchase paid personally by a member."),
                  type: "expense" as Kind,
                  personal: true,
                },
                {
                  title: t("A member lent money"),
                  detail: t("The club receives cash it must repay later."),
                  type: "loan_received" as Kind,
                },
                {
                  title: t("The club repaid someone"),
                  detail: t("Return part or all of a member’s loan."),
                  type: "loan_repayment" as Kind,
                },
              ].map((choice) => (
                <button
                  className="entry-choice"
                  key={choice.title}
                  onClick={() =>
                    setEdit({
                      kind: "transaction",
                      type: choice.type,
                      personal: choice.personal,
                    })
                  }
                >
                  <span>
                    <strong>{t(choice.title)}</strong>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          ) : edit.kind === "cash" ? (
            <div className="member-statement">
              <dl className="statement-lines">
                <div>
                  <dt>
                    {t("Cash received from members")}{" "}
                    <small>{t("Fee payments + loans")}</small>
                  </dt>
                  <dd>{money(cash.cashIn)}</dd>
                </div>
                <div>
                  <dt>{t("Cash spent / repaid")}</dt>
                  <dd>−{money(cash.cashOut)}</dd>
                </div>
                <div className="statement-emphasis">
                  <dt>{t("Cash in hand now")}</dt>
                  <dd>{money(totals.funds)}</dd>
                </div>
              </dl>
              <button
                className="button secondary"
                onClick={() => {
                  setEdit(null);
                  go("Transactions");
                }}
              >
                {t("See all money movements")}
              </button>
            </div>
          ) : edit.kind === "loans" ? (
            <div className="member-statement">
              {data.members
                .filter((m) => totals.members[m.id].loans > 0)
                .map((m) => (
                  <button
                    className="entry-choice"
                    key={m.id}
                    onClick={() => setEdit({ kind: "details", member: m })}
                  >
                    <span>
                      <strong>
                        {m.name}
                        {m.is_me ? t(" (You)") : ""}
                      </strong>
                      <small>{t("Club owes this member")}</small>
                    </span>
                    <strong>{money(totals.members[m.id].loans)}</strong>
                  </button>
                ))}
              {totals.loans === 0 && (
                <p>{t("No member loans remain to be repaid.")}</p>
              )}
            </div>
          ) : edit.kind === "transaction" ? (
            <TransactionForm
              key={edit.record?.id || edit.type}
              {...{ data, busy }}
              type={edit.type}
              record={edit.record}
              initialPersonal={edit.personal}
              onSave={(v) => save("transactions", v, edit.record?.id)}
              onLinked={(record) =>
                setEdit({ kind: "transaction", type: record.type, record })
              }
              onVoid={() =>
                edit.record && setEdit({ kind: "void", record: edit.record })
              }
            />
          ) : edit.kind === "member" ? (
            <MemberForm
              record={edit.record}
              busy={busy}
              onSave={(v) => save("members", v, edit.record?.id)}
            />
          ) : edit.kind === "dues" ? (
            <DuesForm
              members={active}
              dues={data.dues}
              busy={busy}
              onSave={assign}
            />
          ) : edit.kind === "category" ? (
            <CategoryForm
              record={edit.record}
              busy={busy}
              onSave={(v) => save("expense_categories", v, edit.record?.id)}
            />
          ) : edit.kind === "void" ? (
            <VoidForm
              busy={busy}
              onSave={(reason) =>
                save(
                  "transactions",
                  { voided_at: new Date().toISOString(), void_reason: reason },
                  edit.record.id,
                )
              }
            />
          ) : (
            <>
              <MemberStatement
                data={data}
                member={edit.member}
                onTransaction={(record) =>
                  setEdit({ kind: "transaction", type: record.type, record })
                }
              />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function PanelTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h3>{t(title)}</h3>
        <span className="sr-only">{subtitle}</span>
      </div>
      {right}
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Receipt size={25} />
      <h3>{t(title)}</h3>
      <p>{t(text)}</p>
    </div>
  );
}
function Chart({
  data,
  cash = false,
}: {
  data: ActivityPoint[];
  cash?: boolean;
}) {
  return (
    <Suspense
      fallback={<div className="chart loading">{t("Loading chart…")}</div>}
    >
      <LedgerChart data={data} cash={cash} />
    </Suspense>
  );
}
function DateFilters({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <div className="date-filters">
      <input
        aria-label={t("From date")}
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      />
      <span>–</span>
      <input
        aria-label={t("To date")}
        type="date"
        value={to}
        min={from}
        onChange={(e) => setTo(e.target.value)}
      />
    </div>
  );
}
export default App;
