import { labels } from "./lib/labels";
import {
  TransactionForm,
  MemberForm,
  DuesForm,
  CategoryForm,
  VoidForm,
} from "./features/ledger-forms";
import { Auth } from "./features/auth";
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
  TrendingUp,
  Receipt,
  HandCoins,
  MoreHorizontal,
  X,
  Check,
  LogOut,
  Activity,
  ArrowRight,
  CalendarDays,
  CircleHelp,
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
  | { kind: "transaction"; type: Kind; record?: Transaction }
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
  const [page, setPage] = useState("Dashboard"),
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
  const query = useQuery({
    queryKey: ["ledger", session?.user.id],
    enabled: !!session,
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
    values: Record<string, unknown>,
    id?: string,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      if (!online)
        throw new Error(
          "You are offline. Reconnect and try again. Your form is preserved.",
        );
      const payload = { ...values, owner_id: session!.user.id };
      const result = id
        ? await supabase!.from(table).update(payload).eq("id", id)
        : await insertRecord(table, payload);
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
  async function assign(rows: Record<string, unknown>[]) {
    if (!rows.length) return;
    setBusy(true);
    try {
      if (!online) throw new Error("You are offline. Reconnect and try again.");
      const { error } = await supabase!
        .from("dues")
        .insert(
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
      month: d.toLocaleString("en", {
        month: "short",
        year: monthCount > 12 ? "2-digit" : undefined,
      }),
      Contributions: result.collected / 100,
      Expenses: result.expenses / 100,
    };
  });
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
                <strong>{t.description || labels[t.type]}</strong>
                <small>
                  {member?.name ||
                    data.expense_categories.find((c) => c.id === t.category_id)
                      ?.name ||
                    "Group funds"}{" "}
                  <span>· {day(t.transaction_date)}</span>
                </small>
              </span>
              <span className="tx-type">{labels[t.type]}</span>
              <span className={"tx-amount " + t.type}>
                {t.type === "contribution" || t.type === "loan_received"
                  ? "+"
                  : "−"}
                {money(minor(t.amount))}
                <small>
                  {t.voided_at
                    ? "Voided"
                    : t.funding_source === "member_personal"
                      ? "Personal · " + t.personal_settlement
                      : (t.payment_method || "").replaceAll("_", " ")}
                </small>
              </span>
              <ChevronRight size={15} className="muted" />
            </button>
          );
        })}
      </div>
    ) : (
      <Empty
        title="No transactions yet"
        text="Your financial history starts with the first entry."
      />
    );
  }
  if (!supabase)
    return (
      <div className="auth-page">
        <section className="auth-card">
          <h1>Connection not configured</h1>
          <p>Set the Supabase URL and publishable key to use your ledger.</p>
        </section>
      </div>
    );
  if (!authReady) return <div className="loading">Opening your ledger…</div>;
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
            <strong>Our badminton club</strong>
            <small>Personal workspace</small>
          </div>
          <MoreHorizontal size={17} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "nav-item selected" : "nav-item"}
              onClick={() => go(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Dues" && pending.length > 0 && <b>{pending.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={21} />
            <strong>
              A little clarity.
              <br />
              More time on court.
            </strong>
            <p>Your club’s money, all in one place.</p>
          </div>
          <button className="profile" onClick={() => go("Settings")}>
            <span className="avatar">{my?.name.slice(0, 1) || "A"}</span>
            <span>
              <strong>{my?.name || "Administrator"}</strong>
              <small>Club administrator</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <ChevronRight size={14} /> <strong>{page}</strong>
          </span>
          <span className="top-right">
            <span className="sync">
              <span className={"status-dot " + (!online ? "offline" : "")} />
              {online ? "Connected" : "Offline"}
            </span>
            <button
              className="icon-button"
              aria-label="Help"
              onClick={() =>
                setToast(
                  "Record contributions, expenses and loans. All balances are calculated automatically.",
                )
              }
            >
              <CircleHelp size={19} />
            </button>
            <ThemeControl compact />
            <span className="avatar small">{my?.name.slice(0, 1) || "A"}</span>
          </span>
        </header>
        <main>
          {!online && (
            <div className="error-banner">
              You’re offline. Reconnect to save changes.
            </div>
          )}
          {query.isError && (
            <div className="error-banner">
              Could not load your ledger: {query.error.message}
              <button onClick={() => query.refetch()}>Retry</button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR CLUB, IN BALANCE</div>
              <h1>
                {page === "Dashboard" ? "A clear view of your finances." : page}
              </h1>
              <p>
                {
                  (
                    {
                      Dashboard: "Less bookkeeping. More badminton.",
                      Transactions:
                        "Every contribution, purchase, and repayment. In one place.",
                      Members: "The people who keep the game going.",
                      Dues: "Know what’s paid and what’s still to come.",
                      Reports: "A little perspective on your club’s finances.",
                      Settings: "Make this space your own.",
                    } as Record<string, string>
                  )[page]
                }
              </p>
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
                  Export CSV
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
                        : { kind: "transaction", type: "contribution" },
                  )
                }
              >
                <Plus size={17} />
                {page === "Members"
                  ? "Add member"
                  : page === "Dues"
                    ? "Assign dues"
                    : "Add transaction"}
              </button>
            </div>
          </div>
          {!query.isLoading && data.members.length === 0 && (
            <div className="onboarding panel">
              <ShieldCheck size={25} />
              <div>
                <h3>Welcome to your club’s ledger.</h3>
                <p>
                  Add yourself as a member and check ‘This is me’. Your expense
                  categories will be set up automatically.
                </p>
              </div>
              <button
                className="button primary"
                onClick={() => setEdit({ kind: "member" })}
              >
                Add your first member
                <Plus size={16} />
              </button>
            </div>
          )}
          {query.isLoading ? (
            <div className="panel loading">Loading your ledger…</div>
          ) : (
            <>
              {page === "Dashboard" && (
                <>
                  <div className="stats-grid">
                    <div className="stat featured">
                      <div className="stat-label">
                        Available Group Funds <Wallet size={18} />
                      </div>
                      <div className="stat-value">{money(totals.funds)}</div>
                      <div className="stat-footer">
                        <span className="live-dot" /> Ready for the next game{" "}
                        <ArrowUpRight size={15} />
                      </div>
                      <div className="fund-decoration" />
                    </div>
                    {[
                      {
                        name: "Total contributions",
                        value: totals.collected,
                        icon: TrendingUp,
                        detail: "Money received from members",
                        color: "green",
                      },
                      {
                        name: "Total expenses",
                        value: totals.expenses,
                        icon: Receipt,
                        detail: "Everything spent on the game",
                        color: "orange",
                      },
                      {
                        name: "Outstanding dues",
                        value: totals.outstanding,
                        icon: Users,
                        detail: pending.length + " members with a balance",
                        color: "amber",
                      },
                    ].map((s) => (
                      <div className="stat" key={s.name}>
                        <div className="stat-label">
                          {s.name}
                          <s.icon size={18} className={s.color} />
                        </div>
                        <div className="stat-value">{money(s.value)}</div>
                        <div className="stat-footer">{s.detail}</div>
                      </div>
                    ))}
                  </div>
                  <div className="quick-actions">
                    <span>QUICK ADD</span>
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
                          {type === "loan_received"
                            ? "Receive loan"
                            : type === "loan_repayment"
                              ? "Repay loan"
                              : "Add " + type}
                          <Plus size={14} />
                        </button>
                      );
                    })}
                    <button onClick={() => setEdit({ kind: "dues" })}>
                      <span className="quick-icon dues">
                        <ClipboardList size={16} />
                      </span>
                      Assign dues
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="dashboard-columns">
                    <section className="panel chart-panel">
                      <PanelTitle
                        title="Money in, money out"
                        subtitle="A month-by-month look at your club’s activity."
                        right={<span className="period">Last 6 months</span>}
                      />
                      <div className="chart-legend">
                        <span>
                          <i className="green-bg" />
                          Contributions
                        </span>
                        <span>
                          <i className="orange-bg" />
                          Expenses
                        </span>
                      </div>
                      <Chart data={monthly} />
                    </section>
                    <section className="panel dues-panel">
                      <PanelTitle
                        title="Outstanding dues"
                        subtitle="A friendly reminder goes a long way."
                        right={
                          <span className="count-pill">
                            {pending.length} members
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
                              % contributed
                            </small>
                          </span>
                          <strong>
                            {money(totals.members[m.id].outstanding)}
                          </strong>
                        </button>
                      ))}
                      {!pending.length && (
                        <Empty
                          title="All caught up"
                          text="No outstanding member dues."
                        />
                      )}
                      <button className="panel-link" onClick={() => go("Dues")}>
                        View all dues <ArrowRight size={15} />
                      </button>
                    </section>
                  </div>
                  <div className="dashboard-columns bottom">
                    <section className="panel">
                      <PanelTitle
                        title="Recent transactions"
                        subtitle="The latest from your ledger."
                        right={
                          <button
                            className="text-button"
                            onClick={() => go("Transactions")}
                          >
                            View all <ArrowRight size={14} />
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
                    <div className="personal-stack">
                      <section className="panel personal">
                        <div className="personal-header">
                          <span className="tx-icon contribution">
                            <Users size={20} />
                          </span>
                          <span>MY CONTRIBUTION</span>
                          <span className="you-pill">You</span>
                        </div>
                        <h2>{money(my ? totals.members[my.id].credit : 0)}</h2>
                        <p>Your share in keeping the game going.</p>
                        <div>
                          <span>Cash & personal purchases</span>
                          <Check size={16} />
                        </div>
                      </section>
                      <button
                        className="panel loan-card"
                        onClick={() => {
                          go("Transactions");
                          setFilter("loan_received");
                        }}
                      >
                        <span className="tx-icon loan_received">
                          <HandCoins size={20} />
                        </span>
                        <span>
                          <small>Outstanding loans</small>
                          <strong>{money(totals.loans)}</strong>
                        </span>
                        <ChevronRight size={19} />
                      </button>
                    </div>
                  </div>
                  <div className="page-foot">
                    <span>
                      <ShieldCheck size={14} /> Every taka accounted for.
                    </span>
                    <span>Made for the game. Built for peace of mind.</span>
                  </div>
                </>
              )}
              {page === "Transactions" && (
                <section className="panel">
                  <div className="filters">
                    <label className="search">
                      <Search size={17} />
                      <input
                        placeholder="Search transactions…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Transaction type"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All transactions</option>
                      {Object.entries(labels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Member filter"
                      value={memberFilter}
                      onChange={(e) => setMemberFilter(e.target.value)}
                    >
                      <option value="">All members</option>
                      {data.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Category filter"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="">All categories</option>
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
                      Active members <span>{active.length}</span>
                    </button>
                    <button
                      className={memberView === "archived" ? "active" : ""}
                      onClick={() => setMemberView("archived")}
                    >
                      Archived
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
                                aria-label={"Edit " + m.name}
                                onClick={() =>
                                  setEdit({ kind: "member", record: m })
                                }
                              >
                                <MoreHorizontal size={21} />
                              </button>
                            </div>
                            <h3>
                              {m.name}{" "}
                              {m.is_me && <span className="you-pill">You</span>}
                            </h3>
                            <p>{m.phone || "Club member"}</p>
                            <dl>
                              <div>
                                <dt>Contribution credit</dt>
                                <dd className="green">{money(b.credit)}</dd>
                              </div>
                              <div>
                                <dt>Total assigned dues</dt>
                                <dd>{money(b.assigned)}</dd>
                              </div>
                              <div>
                                <dt>Outstanding dues</dt>
                                <dd className={b.outstanding ? "orange" : ""}>
                                  {money(b.outstanding)}
                                </dd>
                              </div>
                              {b.loans > 0 && (
                                <div>
                                  <dt>Loans owed</dt>
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
                              View member <ArrowRight size={15} />
                            </button>
                          </section>
                        );
                      })}
                  </div>
                  {!data.members.length && (
                    <Empty
                      title="Who’s playing?"
                      text="Add your first member to start tracking contributions."
                    />
                  )}
                </>
              )}
              {page === "Dues" && (
                <>
                  <div className="mini-stats">
                    <div className="panel">
                      <small>Total assigned</small>
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
                      <small>Outstanding dues</small>
                      <h2>{money(totals.outstanding)}</h2>
                    </div>
                    <div className="panel">
                      <small>Members fully paid</small>
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
                      title="Member balances"
                      subtitle="Payments and personal contributions automatically reduce dues."
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
                              ? "No dues"
                              : !b.outstanding
                                ? "Paid"
                                : b.credit
                                  ? "Partially paid"
                                  : "Unpaid"}
                          </span>
                          <span>
                            {money(b.outstanding)}
                            <small>of {money(b.assigned)}</small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      );
                    })}
                  </section>
                  <section className="panel assigned">
                    <PanelTitle
                      title="Assigned dues"
                      subtitle="Individual assignments, with their original dates."
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
                                : "No due date"}
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
                      Member balances CSV
                    </button>
                  </div>
                  <div className="dashboard-columns">
                    <section className="panel chart-panel">
                      <PanelTitle
                        title="Monthly contributions & expenses"
                        subtitle="BDT · non-voided transactions"
                      />
                      <Chart data={monthly} />
                    </section>
                    <section className="panel">
                      <PanelTitle
                        title="Expenses by category"
                        subtitle="All funding sources included"
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
                      title="Contributions by member"
                      subtitle="Cash and direct purchases counted as contributions · selected period"
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
                      title="Group funds history"
                      subtitle="Running balance · personal purchases have no effect on available funds"
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
                            <strong>{t.description || labels[t.type]}</strong>
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
                      title="Loan history & funds movement"
                      subtitle="Balances include all prior activity; date filters limit displayed transactions."
                    />
                    <div className="report-summary">
                      <span>
                        Available funds <strong>{money(totals.funds)}</strong>
                      </span>
                      <span>
                        Loans outstanding <strong>{money(totals.loans)}</strong>
                      </span>
                      {my && (
                        <span>
                          Loans owed to you{" "}
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
                  <section className="panel">
                    <PanelTitle
                      title="Your account"
                      subtitle="One club. One simple ledger."
                    />
                    <div className="settings-body">
                      <label>
                        Account email
                        <input
                          readOnly
                          value={session.user.email || "Administrator"}
                        />
                      </label>
                      <label>
                        Currency
                        <input readOnly value="Bangladeshi Taka (BDT · ৳)" />
                      </label>
                      <label>
                        Timezone
                        <input readOnly value="Asia/Dhaka (UTC+06:00)" />
                      </label>
                      <button
                        className="button secondary"
                        onClick={exportTransactions}
                      >
                        <Download size={16} />
                        Export all transactions
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
                          Log out
                        </button>
                      )}
                      <ThemeControl />
                      <UpdateControl />
                    </div>
                  </section>
                  <section className="panel">
                    <PanelTitle
                      title="Expense categories"
                      subtitle="Keep your spending organized."
                      right={
                        <button
                          className="icon-button"
                          aria-label="Add category"
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
                            {c.is_active ? "Active" : "Inactive"} · Order{" "}
                            {c.sort_order}
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
                        Set up default categories
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
              <span>{name}</span>
            </button>
          ))}
          <button
            aria-label="Settings"
            className={page === "Settings" ? "selected" : ""}
            onClick={() => go("Settings")}
          >
            <Settings size={21} />
            <span>Settings</span>
          </button>
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Activity size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {edit && (
        <Modal
          title={
            edit.kind === "transaction"
              ? edit.record
                ? "Transaction details"
                : labels[edit.type]
              : edit.kind === "member"
                ? edit.record
                  ? "Edit member"
                  : "Add a member"
                : edit.kind === "dues"
                  ? "Assign dues"
                  : edit.kind === "category"
                    ? "Expense category"
                    : edit.kind === "void"
                      ? "Void transaction"
                      : edit.member.name
          }
          onClose={() => !busy && setEdit(null)}
        >
          {edit.kind === "transaction" ? (
            <TransactionForm
              key={edit.record?.id || edit.type}
              {...{ data, busy }}
              type={edit.type}
              record={edit.record}
              onSave={(v) => save("transactions", v, edit.record?.id)}
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
            <DuesForm members={active} busy={busy} onSave={assign} />
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
              <div className="detail-stats">
                {Object.entries({
                  "Assigned dues": totals.members[edit.member.id].assigned,
                  "Cash contributions": totals.members[edit.member.id].cash,
                  "Personal purchases":
                    totals.members[edit.member.id].purchases,
                  "Contribution credit": totals.members[edit.member.id].credit,
                  "Outstanding dues":
                    totals.members[edit.member.id].outstanding,
                  "Excess credit": totals.members[edit.member.id].excess,
                  "Loans given": totals.members[edit.member.id].borrowed,
                  Repayments: totals.members[edit.member.id].repaid,
                  "Loans owed": totals.members[edit.member.id].loans,
                }).map(([k, v]) => (
                  <div key={k}>
                    <small>{k}</small>
                    <strong>{money(v)}</strong>
                  </div>
                ))}
              </div>
              <TxList
                rows={data.transactions.filter(
                  (t) =>
                    t.member_id === edit.member.id ||
                    t.paid_by_member_id === edit.member.id,
                )}
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
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {right}
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Receipt size={25} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Chart({
  data,
}: {
  data: { month: string; Contributions: number; Expenses: number }[];
}) {
  return (
    <Suspense fallback={<div className="chart loading">Loading chart…</div>}>
      <LedgerChart data={data} />
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
        aria-label="From date"
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      />
      <span>–</span>
      <input
        aria-label="To date"
        type="date"
        value={to}
        min={from}
        onChange={(e) => setTo(e.target.value)}
      />
    </div>
  );
}
export default App;
