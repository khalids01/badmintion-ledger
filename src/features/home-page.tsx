import { t } from "../lib/i18n";
import { money } from "../lib/accounting";
import { memberPosition } from "../lib/presentation";
import { Avatar } from "../components/ui-kit";
import type { LedgerWorkspace } from "./use-ledger";
import { Plus, ChevronRight } from "lucide-react";

export function HomePage({ workspace, readOnly, onOpenCash, onOpenLoans,
  onOpenMember, onRecordPayment, onOpenAddExpense,
}: {
  workspace: LedgerWorkspace;
  readOnly?: boolean;
  onOpenCash: () => void;
  onOpenLoans: () => void;
  onOpenMember: (member: import("../lib/types").Member) => void;
  onRecordPayment: () => void;
  onOpenAddExpense: () => void;
  onOpenTx: (tx: import("../lib/types").Transaction) => void;
}) {
  const { data, totals, my } = workspace;
  const position = my ? memberPosition(data, my.id, !readOnly && my.is_me) : null;
  return <div className="notebook-home">
    <section className="panel notebook-section">
      <div className="notebook-heading">
        <h3>{t("My money")}</h3>
        <label className="profile-choice">
          <span className="sr-only">{t("Choose your member profile")}</span>
          <select aria-label={t("Choose your member profile")} value={my?.id || ""}
            onChange={event => workspace.setPersonalMember(event.target.value)}>
            <option value="">{t("Choose your member profile")}</option>
            {data.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      </div>
      {my && position ? <>
        <button className="notebook-total" onClick={() => onOpenMember(my)}>
          <span>{t("Total paid so far")}</span><strong>{money(position.totalPaid)}</strong><ChevronRight size={18}/>
        </button>
        <div className="notebook-line"><span>{t("Counts toward my fees")}</span><strong>{money(position.feePaid)}</strong></div>
        <button className="notebook-line" onClick={() => onOpenMember(my)}><span>{t("I still need to pay")}</span><strong>{money(position.due)}</strong></button>
        <button className="notebook-line" onClick={onOpenLoans}><span>{t("Club owes me")}</span><strong>{money(position.loan)}</strong></button>
        {position.unrecorded > 0 && <div className="notebook-note">{t("Cash spending exceeds recorded funding by {amount}. Record your missing loan or payment to include it in your totals.", {amount: money(position.unrecorded)})}</div>}
        {!readOnly && my.is_me && <div className="notebook-line"><span>{t("My money used")}</span><strong>{money(position.collectorMoneyUsed)}</strong></div>}
        <details className="notebook-details"><summary>{t("How my money adds up")}</summary>
          <div className="notebook-line"><span>{t("Cash given")}</span><strong>{money(position.cashPaid)}</strong></div>
          <div className="notebook-line"><span>{t("Spent personally")}</span><strong>{money(position.personalSpent)}</strong></div>
          <div className="notebook-line"><span>{t("Already repaid by club")}</span><strong>{money(position.repaid)}</strong></div>
          <div className="notebook-line"><span>{t("My money still in the club")}</span><strong>{money(position.netPaid)}</strong></div>
          {!readOnly && my.is_me && <>
            <div className="notebook-line"><span>{t("Cash expenses")}</span><strong>{money(position.cashExpenses)}</strong></div>
            <div className="notebook-line"><span>{t("Cash from everyone else")}</span><strong>{money(position.otherCash)}</strong></div>
            <div className="notebook-line"><span>{t("Cash left")}</span><strong>{money(position.cashRemaining)}</strong></div>
            <div className="notebook-line"><span>{t("Repaid to other members")}</span><strong>{money(position.repaidOthers)}</strong></div>
            <p className="notebook-note">{t("Cash left and repayments are included. Other members’ personal purchases are separate from cash expenses.")}</p>
          </>}
        </details>
      </> : <p className="notebook-note">{t("Choose your name to see your payments, loans and dues. This choice is saved for your account on this device.")}</p>}
    </section>
    {!readOnly && <div className="notebook-actions">
      <button className="button primary" onClick={onRecordPayment}><Plus size={18}/>{t("Collect money")}</button>
      <button className="button secondary" onClick={onOpenAddExpense}><Plus size={18}/>{t("Add expense")}</button>
    </div>}
    <section className="panel notebook-section">
      <div className="notebook-heading"><h3>{t("Who paid how much")}</h3></div>
      <div className="notebook-members-head"><span>{t("Members")}</span><span>{t("Total paid")}</span><span>{t("Still due")}</span></div>
      {data.members.map((member, i) => {
        const p = memberPosition(data, member.id);
        return <button className="notebook-member" key={member.id} onClick={() => onOpenMember(member)}>
          <span className="notebook-name"><Avatar name={member.name} index={i} size="sm"/><span>{member.name}{member.id === my?.id ? ` (${t("You")})` : ""}</span></span>
          <strong>{money(p.totalPaid)}</strong><span>{money(p.due)}</span>
        </button>;
      })}
      {!data.members.length && <p className="notebook-note">{t("No members yet")}</p>}
    </section>
    <section className="panel notebook-section">
      <button className="notebook-line" onClick={onOpenCash}><span>{t("Cash in hand")}</span><strong>{money(totals.funds)}</strong></button>
      <div className="notebook-line"><span>{t("Total spent")}</span><strong>{money(totals.expenses)}</strong></div>
      <button className="notebook-line" onClick={onOpenLoans}><span>{t("Club debt")}</span><strong>{money(totals.loans)}</strong></button>
    </section>
  </div>;
}
