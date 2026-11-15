import { calculate, money, minor } from "../lib/accounting";
import {
  memberCashPaid,
  transactionLabel,
  transactionDateLabel,
} from "../lib/presentation";
import { t } from "../features/language";
import type { Ledger, Member, Transaction } from "../lib/types";
export function MemberStatement({
  data,
  member,
  onTransaction,
}: {
  data: Ledger;
  member: Member;
  onTransaction?: (transaction: Transaction) => void;
}) {
  const balance = calculate(data).members[member.id];
  const cash = memberCashPaid(data, member.id);
  const fees = data.dues.filter(
    (d) => d.member_id === member.id && !d.voided_at,
  );
  const transactions = data.transactions
    .filter(
      (tx) =>
        !tx.voided_at &&
        (tx.member_id === member.id || tx.paid_by_member_id === member.id),
    )
    .sort(
      (a, b) =>
        Date.parse(b.transaction_date) - Date.parse(a.transaction_date) ||
        Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  const payments = transactions.filter(
    (tx) =>
      tx.type === "contribution" ||
      tx.type === "loan_received" ||
      (tx.type === "expense" &&
        tx.funding_source === "member_personal" &&
        tx.paid_by_member_id === member.id),
  );
  return (
    <div className="member-statement">
      <div className="statement-total">
        <span>{t("Total paid")}</span>
        <strong>{money(cash + balance.purchases)}</strong>
        <small>{t("Cash given + spent personally")}</small>
        {payments.length > 0 && (
          <div
            className="payment-equation"
            aria-label={t("Individual payments")}
          >
            {payments.map((tx, i) => (
              <span key={tx.id}>
                {i > 0 && <b> + </b>}
                {money(minor(tx.amount))}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="statement-split">
        <div>
          <span>{t("Cash given")}</span>
          <strong>{money(cash)}</strong>
        </div>
        <div>
          <span>{t("Spent personally")}</span>
          <strong>{money(balance.purchases)}</strong>
        </div>
      </div>
      <dl className="statement-lines">
        <div>
          <dt>{t("Still due from member")}</dt>
          <dd>{money(balance.outstanding)}</dd>
        </div>
        <div className="statement-emphasis">
          <dt>{t("Club owes member")}</dt>
          <dd>{money(balance.loans)}</dd>
        </div>
        {balance.repaid > 0 && (
          <div>
            <dt>{t("Already repaid by club")}</dt>
            <dd>{money(balance.repaid)}</dd>
          </div>
        )}
      </dl>
      <details className="fee-details">
        <summary>{t("Fee breakdown")}</summary>
        <dl className="statement-lines">
          <div>
            <dt>{t("Expected payment")}</dt>
            <dd>{money(balance.assigned)}</dd>
          </div>
          <div>
            <dt>{t("Counted toward fees")}</dt>
            <dd>{money(balance.credit)}</dd>
          </div>
          {balance.excess > 0 && (
            <div>
              <dt>{t("Extra fee credit")}</dt>
              <dd>{money(balance.excess)}</dd>
            </div>
          )}
        </dl>
        <div className="fee-breakdown">
          {fees.map((d) => (
            <div key={d.id}>
              <span>{d.title}</span>
              <strong>{money(minor(d.amount))}</strong>
            </div>
          ))}
        </div>
      </details>
      <h3 className="statement-history-title">{t("Payment history")}</h3>
      <div className="payment-history">
        {transactions.map((tx) => {
          const content = (
            <>
              <span>
                <strong>{tx.description || t(transactionLabel(tx))}</strong>
                <small>
                  {t(transactionLabel(tx))} · {transactionDateLabel(tx)}
                </small>
                {tx.type === "expense" &&
                  tx.funding_source === "member_personal" && (
                    <small>
                      {t(
                        tx.personal_settlement === "contribution"
                          ? "Counts toward fees"
                          : "Club will repay",
                      )}
                    </small>
                  )}
              </span>
              <strong>
                {tx.type === "loan_repayment" ? "−" : ""}
                {money(minor(tx.amount))}
              </strong>
            </>
          );
          return onTransaction ? (
            <button
              className="payment-row"
              key={tx.id}
              onClick={() => onTransaction(tx)}
            >
              {content}
            </button>
          ) : (
            <div className="payment-row" key={tx.id}>
              {content}
            </div>
          );
        })}
        {!transactions.length && <p>{t("No payments yet")}</p>}
      </div>
    </div>
  );
}
