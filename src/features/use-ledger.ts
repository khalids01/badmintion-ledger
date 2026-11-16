import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  calculate,
  money,
  minor,
  today,
  day,
  csvDownload,
} from "../lib/accounting";
import { cashMovement, memberCashPaid } from "../lib/presentation";
import { getLanguage } from "../lib/i18n";
import { empty } from "../lib/ledger-defaults";
import type { Ledger, Member, Kind, Transaction, Category } from "../lib/types";
import type { TablesInsert } from "../lib/database.types";

export type Page = "Home" | "Members" | "Transactions" | "Reports" | "Settings";
export type MemberTab = "members" | "dues";

export type Edit =
  | { kind: "add" }
  | {
      kind: "transaction";
      type: Kind;
      record?: Transaction;
      personal?: boolean;
      memberId?: string;
    }
  | { kind: "member"; record?: Member }
  | { kind: "dues" }
  | { kind: "category"; record?: Category }
  | { kind: "details"; member: Member }
  | { kind: "cash" }
  | { kind: "loans" }
  | { kind: "void"; record: Transaction }
  | { kind: "view-tx"; record: Transaction }
  | null;

export function useLedger(
  session: Session | null,
  active: boolean,
  isAdmin = false,
) {
  const client = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [page, setPage] = useState<Page>("Home");
  const [memberTab, setMemberTab] = useState<MemberTab>("members");
  const [memberView, setMemberView] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [chartWeeks, setChartWeeks] = useState(2);

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
      const id = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(id);
    }
  }, [toast]);

  const query = useQuery({
    queryKey: ["ledger", session?.user.id],
    enabled: !!session && active,
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

  const data = query.data || empty;
  const totals = useMemo(() => calculate(data), [data]);
  const cash = useMemo(() => cashMovement(data.transactions), [data]);
  const [personalProfile, setPersonalProfile] = useState<{ account: string; member: string } | null>(null);
  const profileKey = `ledger-personal-member:${session?.user.id || ""}`;
  let savedMember = "";
  try { savedMember = localStorage.getItem(profileKey) || ""; } catch { /* Optional storage. */ }
  const personalId = personalProfile && personalProfile.account === session?.user.id ? personalProfile.member : savedMember;
  const my = data.members.find(m => m.id === personalId) ||
    (isAdmin ? data.members.find(m => m.is_me) : undefined);
  function setPersonalMember(member: string) {
    if (!session) return;
    setPersonalProfile({ account: session.user.id, member });
    try { localStorage.setItem(profileKey, member); } catch { /* Optional storage. */ }
  }
  const activeMembers = data.members.filter((m) => m.is_active);
  const pending = useMemo(
    () =>
      data.members
        .filter((m) => totals.members[m.id].outstanding > 0)
        .sort(
          (a, b) =>
            totals.members[b.id].outstanding - totals.members[a.id].outstanding,
        ),
    [data.members, totals.members],
  );

  const filtered = useMemo(
    () =>
      data.transactions.filter(
        (t) =>
          (typeFilter === "all" || t.type === typeFilter) &&
          (!memberFilter ||
            t.member_id === memberFilter ||
            t.paid_by_member_id === memberFilter) &&
          (!categoryFilter || t.category_id === categoryFilter) &&
          (!from || t.transaction_date.slice(0, 10) >= from) &&
          (!to || t.transaction_date.slice(0, 10) <= to) &&
          (t.description || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [
      data.transactions,
      typeFilter,
      memberFilter,
      categoryFilter,
      from,
      to,
      search,
    ],
  );

  const recent = useMemo(
    () =>
      [...data.transactions]
        .sort(
          (a, b) =>
            Date.parse(b.transaction_date) - Date.parse(a.transaction_date) ||
            Date.parse(b.created_at) - Date.parse(a.created_at),
        )
        .slice(0, 5),
    [data.transactions],
  );

  const monthly = useMemo(() => {
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
    return Array.from({ length: Math.min(monthCount, 120) }, (_, i) => {
      const d = new Date(monthlyStart);
      d.setMonth(d.getMonth() + i);
      const key =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      const rows = filtered.filter(
        (t) => t.transaction_date.slice(0, 7) === key,
      );
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
  }, [filtered, from, to, data]);

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
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      if (!online)
        throw new Error(
          "You are offline. Reconnect and try again. Your form is preserved.",
        );
      const result = Array.isArray(values)
        ? await supabase!.from("transactions").insert(
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
          : table === "members"
            ? await supabase!
                .from("members")
                .insert({
                  ...values,
                  owner_id: session!.user.id,
                } as TablesInsert<"members">)
            : table === "transactions"
              ? await supabase!
                  .from("transactions")
                  .insert({
                    ...values,
                    owner_id: session!.user.id,
                  } as TablesInsert<"transactions">)
              : table === "dues"
                ? await supabase!
                    .from("dues")
                    .insert({
                      ...values,
                      owner_id: session!.user.id,
                    } as TablesInsert<"dues">)
                : await supabase!.from("expense_categories").insert({
                    ...values,
                    owner_id: session!.user.id,
                  } as TablesInsert<"expense_categories">);
      if (result.error) throw result.error;
      await client.invalidateQueries({ queryKey: ["ledger"] });
      setToast("Saved successfully");
      return true;
    } catch (e) {
      notify(e);
      return false;
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
    if (!rows.length) return true;
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
      setToast("Dues assigned");
      return true;
    } catch (e) {
      notify(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function go(next: Page, options?: { memberTab?: MemberTab }) {
    setPage(next);
    if (options?.memberTab) setMemberTab(options.memberTab);
    setSearch("");
    setMemberSearch("");
    setTypeFilter("all");
    setFrom("");
    setTo("");
    setCategoryFilter("");
    setMemberFilter("");
    setAdvanced(false);
  }

  function exportCsv(rows: Transaction[], name = "badminton-transactions.csv") {
    try {
      csvDownload(
        name,
        rows.map((t) => ({
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

  function exportMemberCsv() {
    try {
      csvDownload(
        "badminton-member-report.csv",
        data.members.map((m) => ({
          member: m.name,
          ...Object.fromEntries(
            Object.entries(totals.members[m.id]).map(([k, v]) => [
              k,
              ((v as number) / 100).toFixed(2),
            ]),
          ),
        })),
      );
    } catch (e) {
      notify(e);
    }
  }

  return {
    query,
    data,
    totals,
    cash,
    my,
    setPersonalMember,
    activeMembers,
    pending,
    filtered,
    recent,
    monthly,
    online,
    toast,
    setToast,
    busy,
    page,
    memberTab,
    setMemberTab,
    memberView,
    setMemberView,
    memberSearch,
    setMemberSearch,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    memberFilter,
    setMemberFilter,
    categoryFilter,
    setCategoryFilter,
    from,
    setFrom,
    to,
    setTo,
    advanced,
    setAdvanced,
    chartWeeks,
    setChartWeeks,
    save,
    assign,
    selectMyMember,
    go,
    exportCsv,
    exportMemberCsv,
    notify,
    money,
    minor,
    day,
    memberCashPaid,
  };
}
export type LedgerWorkspace = ReturnType<typeof useLedger>;
