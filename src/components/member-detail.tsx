import { ScreenshotButton } from "./screenshot-button";
import { t } from "../lib/i18n";
import { calculate, money } from "../lib/accounting";
import { isTemporaryMember } from "../lib/presentation";
import { Avatar, MemberBadge } from "./ui-kit";
import { MemberStatement } from "./member-statement";
import { HandCoins, Pencil, CreditCard } from "lucide-react";
import type { Ledger, Member, Transaction } from "../lib/types";

export function MemberDetail({
  data,
  member,
  index = 0,
  onTransaction,
  onRecordPayment,
  onEditMember,
}: {
  data: Ledger;
  member: Member;
  index?: number;
  onTransaction?: (tx: Transaction) => void;
  onRecordPayment?: (member: Member) => void;
  onEditMember?: (member: Member) => void;
}) {
  const totals = calculate(data);
  const balance = totals.members[member.id];

  return (
    <div className="member-statement">
      <ScreenshotButton />
      <div className="member-detail-hero">
        <Avatar name={member.name} size="lg" index={index} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>
            {member.name}
            {isTemporaryMember(member) && (
              <span className="badge neutral temporary-badge">
                {t("Temporary")}
              </span>
            )}
          </h3>
          <p>
            {member.phone || t("Club member")}
            {" · "}
            <MemberBadge
              outstanding={balance.outstanding}
              assigned={balance.assigned}
              credit={balance.credit}
            />
          </p>
        </div>
        {onEditMember && (
          <button
            className="icon-button"
            aria-label={t("Edit {name}", { name: member.name })}
            onClick={() => onEditMember(member)}
          >
            <Pencil size={19} />
          </button>
        )}
      </div>

      <MemberStatement
        data={data}
        member={member}
        onTransaction={onTransaction}
      />

      {onRecordPayment && (
        <button
          className="button primary"
          style={{ width: "100%" }}
          onClick={() => onRecordPayment(member)}
        >
          <CreditCard size={17} />
          {t("Record payment for {name}", { name: member.name })}
        </button>
      )}

      {balance.loans > 0 && (
        <div
          className="info-box"
          style={{ display: "flex", gap: 10, alignItems: "center" }}
        >
          <HandCoins size={18} />
          <span>
            {t("Club owes {name} {amount}", {
              name: member.name,
              amount: money(balance.loans),
            })}
          </span>
        </div>
      )}


    </div>
  );
}
