import { t } from "../lib/i18n";
import { money, minor, day } from "../lib/accounting";
import { Avatar, PanelTitle, Empty, MemberBadge } from "../components/ui-kit";
import type { LedgerWorkspace } from "./use-ledger";
import type { Member } from "../lib/types";
import { Search, ChevronRight, Plus } from "lucide-react";

export function MembersPage({
  workspace,
  readOnly,
  onOpenMember,
  onAddMember,
  onAssignDues,
}: {
  workspace: LedgerWorkspace;
  readOnly?: boolean;
  onOpenMember: (member: Member) => void;
  onAddMember?: () => void;
  onAssignDues?: () => void;
}) {
  const {
    data,
    totals,
    memberView,
    setMemberView,
    memberSearch,
    setMemberSearch,
    memberTab,
    setMemberTab,
  } = workspace;

  const assignedTotal = Object.values(totals.members).reduce(
    (sum, m) => sum + m.assigned,
    0,
  );
  const fullyPaid = data.members.filter(
    (m) =>
      totals.members[m.id].assigned > 0 && !totals.members[m.id].outstanding,
  ).length;

  if (memberTab === "dues") {
    return (
      <>
        <div className="section-tabs">
          <button onClick={() => setMemberTab("members")}>
            {t("Members")}
            <span>{data.members.length}</span>
          </button>
          <button className="active" onClick={() => setMemberTab("dues")}>
            {t("Dues")}
            <span>{pendingDues(workspace)}</span>
          </button>
        </div>
        <div className="mini-stats">
          <div>
            <small>{t("Total fees charged")}</small>
            <h2>{money(assignedTotal)}</h2>
          </div>
          <div>
            <small>{t("Still due")}</small>
            <h2>{money(totals.outstanding)}</h2>
          </div>
          <div>
            <small>{t("Members fully paid")}</small>
            <h2>{fullyPaid}</h2>
          </div>
        </div>
        {!readOnly && onAssignDues && (
          <div style={{ marginBottom: 12 }}>
            <button className="button secondary" onClick={onAssignDues}>
              <Plus size={16} />
              {t("Assign dues")}
            </button>
          </div>
        )}
        <section className="panel">
          <PanelTitle title="Member balances" />
          {data.members.map((m, i) => {
            const b = totals.members[m.id];
            return (
              <button
                className="balance-row"
                key={m.id}
                onClick={() => onOpenMember(m)}
              >
                <Avatar name={m.name} index={i} size="sm" />
                <strong>{m.name}</strong>
                <MemberBadge
                  outstanding={b.outstanding}
                  assigned={b.assigned}
                  credit={b.credit}
                />
                <span className="balance-amount">
                  <strong>{money(b.outstanding)}</strong>
                  <small>
                    {t("of")} {money(b.assigned)}
                  </small>
                </span>
                <ChevronRight size={16} className="muted" />
              </button>
            );
          })}
        </section>
        <section className="panel assigned">
          <PanelTitle
            title="Expected payment"
            subtitle="Entry fees and weekly periods charged to each member."
          />
          {data.dues
            .filter((d) => !d.voided_at)
            .map((d) => (
              <div className="assigned-row" key={d.id}>
                <span>
                  <strong>{d.title}</strong>
                  <small>
                    {data.members.find((m) => m.id === d.member_id)?.name}
                    {" · "}
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
    );
  }

  const q = memberSearch.trim().toLowerCase();
  const visible = data.members
    .filter((m) => m.is_active === (memberView === "active"))
    .filter((m) =>
      !q ? true : (m.name + " " + (m.phone || "")).toLowerCase().includes(q),
    );

  return (
    <>
      <div className="section-tabs">
        <button className="active" onClick={() => setMemberTab("members")}>
          {t("Members")}
          <span>{data.members.length}</span>
        </button>
        <button onClick={() => setMemberTab("dues")}>
          {t("Dues")}
          <span>{pendingDues(workspace)}</span>
        </button>
      </div>

      <div className="filters" style={{ paddingTop: 0, paddingBottom: 14 }}>
        <label className="search">
          <Search size={18} />
          <input
            placeholder={t("Search members…")}
            aria-label={t("Search members…")}
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
          />
        </label>
        <div className="chip-row" style={{ padding: 0, border: 0 }}>
          <button
            className={"chip" + (memberView === "active" ? " active" : "")}
            onClick={() => setMemberView("active")}
          >
            {t("Active members")}
          </button>
          <button
            className={"chip" + (memberView === "archived" ? " active" : "")}
            onClick={() => setMemberView("archived")}
          >
            {t("Archived")}
          </button>
        </div>
        {!readOnly && onAddMember && (
          <button className="button primary" onClick={onAddMember}>
            <Plus size={16} />
            {t("Add member")}
          </button>
        )}
      </div>

      <section className="panel member-list">
        {visible.map((m, i) => {
          const b = totals.members[m.id];
          return (
            <button
              className="member-row"
              key={m.id}
              onClick={() => onOpenMember(m)}
            >
              <Avatar name={m.name} index={i} />
              <span className="member-main">
                <strong>{m.name}</strong>
                <small>{m.phone || t("Club member")}</small>
              </span>
              <span className="member-due">
                <MemberBadge
                  outstanding={b.outstanding}
                  assigned={b.assigned}
                  credit={b.credit}
                />
                <strong className={b.outstanding ? "orange" : undefined}>
                  {b.outstanding ? money(b.outstanding) : money(0)}
                </strong>
              </span>
              <ChevronRight size={16} className="muted" />
            </button>
          );
        })}
        {!visible.length && (
          <Empty
            title={memberSearch ? "No matching members" : "Who’s playing?"}
            text={
              memberSearch
                ? "Try a different name or phone number."
                : "Add your first member to start tracking contributions."
            }
          />
        )}
      </section>
    </>
  );
}

function pendingDues(workspace: LedgerWorkspace) {
  return workspace.pending.length;
}
