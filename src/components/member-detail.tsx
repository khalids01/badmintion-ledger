import { t } from "../lib/i18n";
import { calculate, money } from "../lib/accounting";
import { memberCashPaid } from "../lib/presentation";
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
  const cash = memberCashPaid(data, member.id);

  return (
    <div className="member-statement">
      <div className="member-detail-hero">
        <Avatar name={member.name} size="lg" index={index} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{member.name}</h3>
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

      <div className="detail-stats">
        <div>
          <small>{t("Total fees charged")}</small>
          <strong>{money(balance.assigned)}</strong>
        </div>
        <div>
          <small>{t("Total payments")}</small>
          <strong>{money(cash + balance.purchases)}</strong>
        </div>
        <div>
          <small>{t("Remaining dues")}</small>
          <strong className={balance.outstanding ? "orange" : undefined}>
            {money(balance.outstanding)}
          </strong>
        </div>
      </div>

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

      <MemberStatement
        data={data}
        member={member}
        onTransaction={onTransaction}
      />
    </div>
  );
}
