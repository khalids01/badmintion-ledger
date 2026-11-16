import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { loadAccess, AccessScreen } from "./features/club";
import { Auth } from "./features/auth";
import {
  AppShellNav,
  DesktopAddButton,
  HeaderActions,
  type Page,
} from "./features/shell";
import { WorkspaceView } from "./features/workspace";
import { useLedger, type Edit } from "./features/use-ledger";
import { useLanguage } from "./features/language";
import { t } from "./lib/i18n";
import { money, day, today } from "./lib/accounting";
import { labels } from "./lib/labels";
import { categoryNames } from "./lib/ledger-defaults";
import { Modal } from "./components/ui/dialog";
import { AddSheet } from "./components/add-sheet";
import { MemberDetail } from "./components/member-detail";
import { TxDetail } from "./components/tx-detail";
import {
  TransactionForm,
  MemberForm,
  DuesForm,
  CategoryForm,
  VoidForm,
} from "./features/ledger-forms";
import { supabase } from "./lib/supabase";
import type { Member, Transaction } from "./lib/types";
import { X, Activity, ShieldCheck, Plus, HandCoins } from "lucide-react";

const pageTitles: Record<Page, string> = {
  Home: "Home",
  Members: "Members",
  Transactions: "Transactions",
  Reports: "Reports",
  Settings: "Settings",
};

function App() {
  useLanguage();
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(!supabase),
    [recovering, setRecovering] = useState(
      window.location.hash.includes("type=recovery"),
    ),
    [edit, setEdit] = useState<Edit>(null),
    [authError, setAuthError] = useState(""),
    [online, setOnline] = useState(navigator.onLine);
  const client = useQueryClient();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message);
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

  const active =
    !!session && access.data?.status === "active" && !access.isError;
  const workspace = useLedger(session, active, access.data?.is_admin === true);
  const { data, totals, cash } = workspace;
  const readOnly = !!access.data && !access.data.is_admin;
  const { toast, setToast } = workspace;
  useEffect(() => {
    if (authError) {
      setToast(authError);
      setAuthError("");
    }
  }, [authError, setToast]);

  async function save(
    table: "members" | "transactions" | "dues" | "expense_categories",
    values: Record<string, unknown> | Record<string, unknown>[],
    id?: string,
  ): Promise<boolean> {
    const done = await workspace.save(table, values, id);
    if (done) setEdit(null);
    return done;
  }

  async function assign(rows: Record<string, unknown>[]) {
    const done = await workspace.assign(rows);
    if (done) setEdit(null);
  }

  const notify = (e: unknown) =>
    setToast(
      e instanceof Error
        ? e.message
        : String((e as { message?: string })?.message || e),
    );

  async function seedCategories() {
    try {
      if (!session) return;
      const { error } = await supabase!.from("expense_categories").insert(
        categoryNames.map((name, i) => ({
          owner_id: session.user.id,
          name,
          sort_order: i,
          is_active: true,
        })),
      );
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ["ledger"] });
      setToast("Default categories created");
    } catch (e) {
      notify(e);
    }
  }

  const openAdd = () => setEdit({ kind: "add" });
  const openRecordPayment = (member?: Member) =>
    setEdit({
      kind: "transaction",
      type: "contribution",
      memberId: member?.id,
    });
  const openTx = (tx: Transaction) =>
    readOnly
      ? setEdit({ kind: "view-tx", record: tx })
      : setEdit({ kind: "transaction", type: tx.type, record: tx });
  const openMember = (member: Member) => setEdit({ kind: "details", member });
  const exportTransactions = () => workspace.exportCsv(workspace.filtered);

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <img src="/brand.svg" alt="" />
          <span>
            <strong>Badminton Ledger</strong>
            <small>{t(readOnly ? "Club member" : "Club administrator")}</small>
          </span>
        </div>
        <AppShellNav
          page={workspace.page}
          duesCount={workspace.pending.length}
          onNavigate={(page) => workspace.go(page)}
          onAdd={openAdd}
          canAdd={!readOnly}
        />
        {!readOnly && <DesktopAddButton onClick={openAdd} />}
        <span className="sync">
          <span className={"status-dot" + (!online ? " offline" : "")} />
          {online ? t("Connected") : t("Offline")}
        </span>
        <HeaderActions
          page={workspace.page}
          onNavigate={(page) => workspace.go(page)}
          canGoSettings
        />
      </header>
      <ScrollMarker />

      <main>
        {!online && (
          <div className="error-banner">
            {t("You’re offline. Reconnect to save changes.")}
          </div>
        )}
        {workspace.query.isError && (
          <div className="error-banner">
            {t("Could not load your ledger:")} {workspace.query.error.message}
            <button onClick={() => workspace.query.refetch()}>
              {t("Retry")}
            </button>
          </div>
        )}

        <div className="page-heading">
          <div>
            <div className="eyebrow">
              {t(readOnly ? "CLUB MEMBER" : "YOUR CLUB, IN BALANCE")}
            </div>
            <h1>{t(pageTitles[workspace.page])}</h1>
          </div>
          <div className="heading-actions">
            {workspace.page === "Home" && (
              <span className="date-label">
                {day(today() + "T12:00:00+06:00")}
              </span>
            )}
            {readOnly && (
              <span className="badge neutral">{t("Read-only")}</span>
            )}
          </div>
        </div>

        {!workspace.query.isLoading &&
          data.members.length === 0 &&
          !readOnly && (
            <div className="panel onboarding">
              <ShieldCheck size={26} />
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

        {workspace.query.isLoading ? (
          <div
            className="panel skeleton-stack"
            aria-label={t("Loading your ledger…")}
          >
            {[0, 1, 2, 3].map((i) => (
              <div className="skeleton skeleton-row" key={i} />
            ))}
          </div>
        ) : (
          <WorkspaceView
            workspace={workspace}
            session={session}
            readOnly={readOnly}
            onOpenCash={() => setEdit({ kind: "cash" })}
            onOpenLoans={() => setEdit({ kind: "loans" })}
            onOpenMember={openMember}
            onRecordPayment={() => openRecordPayment()}
            onOpenAddExpense={() =>
              setEdit({ kind: "transaction", type: "expense" })
            }
            onOpenAssignDues={() => setEdit({ kind: "dues" })}
            onOpenAddMember={() => setEdit({ kind: "member" })}
            onOpenTx={openTx}
            onLogout={() => void logout()}
            onSelectMyMember={(id) => void workspace.selectMyMember(id)}
            onExportTransactions={exportTransactions}
            onExportMembers={() => workspace.exportMemberCsv()}
            onOpenCategory={(record) => setEdit({ kind: "category", record })}
            onSeedCategories={() => void seedCategories()}
          />
        )}
      </main>

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
          title={modalTitle(edit)}
          onClose={() => !workspace.busy && setEdit(null)}
        >
          {edit.kind === "add" ? (
            <AddSheet
              onPick={(choice) => {
                if (choice === "dues") setEdit({ kind: "dues" });
                else
                  setEdit({
                    kind: "transaction",
                    type: choice.type,
                    personal: choice.personal,
                  });
              }}
            />
          ) : edit.kind === "view-tx" ? (
            <TxDetail ledger={data} tx={edit.record} />
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
                  workspace.go("Transactions");
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
                    className="add-option"
                    key={m.id}
                    onClick={() => setEdit({ kind: "details", member: m })}
                  >
                    <span className="tx-icon loan_received">
                      <HandCoins size={20} />
                    </span>
                    <span className="option-main">
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
                <p className="form-hint">
                  {t("No member loans remain to be repaid.")}
                </p>
              )}
            </div>
          ) : edit.kind === "transaction" ? (
            <TransactionForm
              key={edit.record?.id || edit.type + (edit.memberId || "")}
              data={data}
              type={edit.type}
              record={edit.record}
              initialPersonal={edit.personal}
              initialMemberId={edit.memberId}
              busy={workspace.busy}
              onSave={(v) => {
                if (
                  edit.record?.type === "contribution" &&
                  !Array.isArray(v) &&
                  v.type === "loan_repayment" &&
                  v.id
                ) {
                  return workspace.save("transactions", v);
                }
                return save("transactions", v, edit.record?.id);
              }}
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
              busy={workspace.busy}
              onSave={(v) => save("members", v, edit.record?.id)}
            />
          ) : edit.kind === "dues" ? (
            <DuesForm
              members={workspace.activeMembers}
              dues={data.dues}
              busy={workspace.busy}
              onSave={assign}
            />
          ) : edit.kind === "category" ? (
            <CategoryForm
              record={edit.record}
              busy={workspace.busy}
              onSave={(v) => save("expense_categories", v, edit.record?.id)}
            />
          ) : edit.kind === "void" ? (
            <VoidForm
              busy={workspace.busy}
              onSave={(reason) =>
                save(
                  "transactions",
                  {
                    voided_at: new Date().toISOString(),
                    void_reason: reason,
                  },
                  edit.record.id,
                )
              }
            />
          ) : (
            <MemberDetail
              data={data}
              member={edit.member}
              onRecordPayment={
                readOnly ? undefined : (m) => openRecordPayment(m)
              }
              onEditMember={
                readOnly
                  ? undefined
                  : (m) => setEdit({ kind: "member", record: m })
              }
              onTransaction={(record) =>
                readOnly
                  ? setEdit({ kind: "view-tx", record })
                  : setEdit({ kind: "transaction", type: record.type, record })
              }
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function modalTitle(edit: NonNullable<Edit>): string {
  switch (edit.kind) {
    case "add":
      return t("Add");
    case "cash":
      return t("Where is the club’s cash?");
    case "loans":
      return t("Who must the club repay?");
    case "view-tx":
      return t("Transaction details");
    case "transaction":
      return edit.record ? t("Transaction details") : t(labels[edit.type]);
    case "member":
      return edit.record ? t("Edit member") : t("Add a member");
    case "dues":
      return t("Assign dues");
    case "category":
      return t("Expense category");
    case "void":
      return t("Void transaction");
    case "details":
      return edit.member.name;
  }
}

function ScrollMarker() {
  useEffect(() => {
    const shell = document.querySelector(".app-shell");
    if (!shell) return;
    const on = () => shell.classList.toggle("scrolled", window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return null;
}

export default App;
