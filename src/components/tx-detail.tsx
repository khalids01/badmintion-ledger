import { t } from "../lib/i18n";
import { money, minor } from "../lib/accounting";
import {
  withoutLink,
  transactionLabel,
  transactionDateLabel,
} from "../lib/presentation";
import { paymentMethodLabel, txIcons } from "./tx-list";
import { labels } from "../lib/labels";
import type { Ledger, Transaction } from "../lib/types";

export function TxDetail({ ledger, tx }: { ledger: Ledger; tx: Transaction }) {
  const Icon = txIcons[tx.type];
  const member = ledger.members.find(
    (m) => m.id === (tx.member_id || tx.paid_by_member_id),
  );
  const category = ledger.expense_categories.find(
    (c) => c.id === tx.category_id,
  );
  const sign =
    tx.voided_at || tx.funding_source === "member_personal"
      ? ""
      : tx.type === "contribution" || tx.type === "loan_received"
        ? "+"
        : "−";
  return (
    <div className="member-statement">
      {tx.voided_at && (
        <div className="error-banner">
          {t("Voided:")} {tx.void_reason}
        </div>
      )}
      <div className="member-detail-hero">
        <span
          className={"tx-icon " + tx.type}
          style={{ width: 52, height: 52, borderRadius: 14 }}
        >
          <Icon size={24} />
        </span>
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 17 }}>
            {tx.description || t(labels[tx.type])}
          </strong>
          <small>{transactionLabel(tx)}</small>
        </span>
        <strong style={{ marginLeft: "auto", fontSize: 22 }}>
          {sign}
          {money(minor(tx.amount))}
        </strong>
      </div>
      <dl className="statement-lines">
        <div>
          <dt>{t("Date")}</dt>
          <dd>{transactionDateLabel(tx)}</dd>
        </div>
        <div>
          <dt>{t("Type")}</dt>
          <dd>{t(labels[tx.type])}</dd>
        </div>
        {member && (
          <div>
            <dt>{t("Member")}</dt>
            <dd>{member.name}</dd>
          </div>
        )}
        {category && (
          <div>
            <dt>{t("Category")}</dt>
            <dd>{category.name}</dd>
          </div>
        )}
        {!tx.funding_source || tx.funding_source === "group_funds" ? (
          <div>
            <dt>{t("Payment method")}</dt>
            <dd>{paymentMethodLabel(tx.payment_method)}</dd>
          </div>
        ) : null}
        {withoutLink(tx.notes) && (
          <div>
            <dt>{t("Notes")}</dt>
            <dd style={{ textAlign: "right", maxWidth: "60%" }}>
              {withoutLink(tx.notes)}
            </dd>
          </div>
        )}
      </dl>
      <p className="form-hint">
        {t("Only the administrator can edit or void transactions.")}
      </p>
    </div>
  );
}
