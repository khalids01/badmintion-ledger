import { calculate, money, minor } from "../lib/accounting";
import { memberCashPaid } from "../lib/presentation";
import type { Ledger, Member } from "../lib/types";
export function MemberStatement({
  data,
  member,
}: {
  data: Ledger;
  member: Member;
}) {
  const balance = calculate(data).members[member.id];
  const fees = data.dues.filter(
    (d) => d.member_id === member.id && !d.voided_at,
  );
  return (
    <div className="member-statement">
      <div
        className={`statement-status ${balance.outstanding ? "unpaid" : "paid"}`}
      >
        <strong>
          {balance.outstanding
            ? `${money(balance.outstanding)} still due from ${member.name}`
            : balance.assigned === 0
              ? "No fees assigned yet"
              : "Entry and weekly fees fully paid"}
        </strong>
        <p>
          {balance.loans > 0
            ? `The club also owes ${member.name} ${money(balance.loans)}. This is separate from fees.`
            : "The club has no loan to repay to this member."}
        </p>
      </div>
      <dl className="statement-lines">
        <div>
          <dt>Expected payment</dt>
          <dd>{money(balance.assigned)}</dd>
        </div>
        <div>
          <dt>
            Cash paid to club{" "}
            <small>Includes fee payments and money lent</small>
          </dt>
          <dd>{money(memberCashPaid(data, member.id))}</dd>
        </div>
        <div>
          <dt>
            Items / purchases provided{" "}
            <small>Paid personally; no cash added to club</small>
          </dt>
          <dd>{money(balance.purchases)}</dd>
        </div>
        <div>
          <dt>Counted toward fees</dt>
          <dd>{money(balance.credit)}</dd>
        </div>
        <div>
          <dt>Still due from member</dt>
          <dd>{money(balance.outstanding)}</dd>
        </div>
        <div className="statement-emphasis">
          <dt>
            Club owes member <small>Remaining loan to repay</small>
          </dt>
          <dd>{money(balance.loans)}</dd>
        </div>
        {balance.repaid > 0 && (
          <div>
            <dt>Already repaid by club</dt>
            <dd>{money(balance.repaid)}</dd>
          </div>
        )}
        {balance.excess > 0 && (
          <div>
            <dt>
              Extra fee credit{" "}
              <small>This is recorded as credit, separate from loans</small>
            </dt>
            <dd>{money(balance.excess)}</dd>
          </div>
        )}
      </dl>
      <h3>What makes up the expected payment?</h3>
      <div className="fee-breakdown">
        {fees.map((d) => (
          <div key={d.id}>
            <span>{d.title}</span>
            <strong>{money(minor(d.amount))}</strong>
          </div>
        ))}
        {!fees.length && <p>No fees have been assigned yet.</p>}
      </div>
    </div>
  );
}
