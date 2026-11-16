import { t } from "../lib/i18n";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { calculate, minor, money, today } from "../lib/accounting";
import type {
  Ledger,
  Kind,
  Transaction,
  Member,
  Category,
  Due,
} from "../lib/types";
import {
  isOriginalDateUnknown,
  isTemporaryMember,
  linkedEntry,
  linkedRepayments,
  withoutLink,
  withLink,
  withTemporaryMark,
  withoutTemporaryMark,
} from "../lib/presentation";
import { labels } from "../lib/labels";
const txSchema = z
  .object({
    type: z.enum([
      "contribution",
      "expense",
      "loan_received",
      "loan_repayment",
    ]),
    amount: z.string().refine((v) => {
      try {
        return minor(v) > 0;
      } catch {
        return false;
      }
    }, "Enter a valid amount greater than zero"),
    date: z
      .string()
      .refine(
        (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
        "Select a valid date",
      ),
    member_id: z.string(),
    category_id: z.string(),
    funding_source: z.enum(["group_funds", "member_personal"]),
    personal_settlement: z.enum(["contribution", "loan"]),
    payment_method: z.string(),
    description: z.string().max(250),
    notes: z.string().max(2000),
    use_repayment: z.boolean(),
    repay_member: z.string(),
    repay_amount: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.type !== "expense" && !v.date)
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "Select a date",
      });
    if (
      (v.type !== "expense" || v.funding_source === "member_personal") &&
      !v.member_id
    )
      ctx.addIssue({
        code: "custom",
        path: ["member_id"],
        message: "Choose a member",
      });
    if (v.type === "expense" && !v.category_id)
      ctx.addIssue({
        code: "custom",
        path: ["category_id"],
        message: "Choose a category",
      });
  });
type TxValues = z.infer<typeof txSchema>;
export function TransactionForm({
  data,
  type,
  record,
  initialPersonal = false,
  initialMemberId,
  busy,
  onSave,
  onVoid,
  onLinked,
}: {
  data: Ledger;
  type: Kind;
  record?: Transaction;
  initialPersonal?: boolean;
  initialMemberId?: string;
  busy: boolean;
  onSave: (
    v: Record<string, unknown> | Record<string, unknown>[],
  ) => void | boolean | Promise<void | boolean>;
  onVoid: () => void;
  onLinked?: (record: Transaction) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors },
  } = useForm<TxValues>({
    resolver: zodResolver(txSchema),
    defaultValues: {
      type,
      amount: record ? String(record.amount) : "",
      date: record
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Dhaka",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(record.transaction_date))
        : today(),
      member_id:
        record?.member_id || record?.paid_by_member_id || initialMemberId || "",
      category_id:
        record?.category_id ||
        data.expense_categories.filter((c) => c.is_active)[0]?.id ||
        "",
      funding_source:
        record?.funding_source ||
        (initialPersonal ? "member_personal" : "group_funds"),
      personal_settlement: record?.personal_settlement || "contribution",
      payment_method: record?.payment_method || "cash",
      description: record?.description || "",
      notes: withoutLink(record?.notes),
      use_repayment: false,
      repay_member:
        data.members.find(
          (m) => m.is_me && calculate(data).members[m.id].loans > 0,
        )?.id || "",
      repay_amount: "",
    },
  });
  const [linkedIds] = useState(() => [
    crypto.randomUUID(),
    crypto.randomUUID(),
  ]);
  const linked = record ? linkedEntry(data, record) : undefined;
  const repaymentsOnRecord = record ? linkedRepayments(data, record) : [];
  const safeMinor = (v: string) => {
    try {
      return minor(v);
    } catch {
      return 0;
    }
  };
  const allocatedToRecord = repaymentsOnRecord.reduce(
    (sum, row) => sum + safeMinor(String(row.amount)),
    0,
  );
  const recordAmount = record ? safeMinor(String(record.amount)) : 0;
  const remainingPayment = Math.max(0, recordAmount - allocatedToRecord);
  const applyCandidate =
    !!record && record.type === "contribution" && !record.voided_at;
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyId] = useState(() => crypto.randomUUID());
  const [applyMember, setApplyMember] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [applyError, setApplyError] = useState("");
  const kind = watch("type"),
    personal =
      kind === "expense" && watch("funding_source") === "member_personal",
    member = watch("member_id"),
    settlement = watch("personal_settlement"),
    amountText = watch("amount"),
    useRepayment = !record && kind === "contribution" && watch("use_repayment"),
    repayMember = watch("repay_member"),
    repayAmountText = watch("repay_amount");
  const adjusted = {
      ...data,
      transactions: data.transactions.filter((t) => t.id !== record?.id),
    },
    summary = calculate(adjusted),
    balance = summary.members[member]?.loans || 0;
  let previewAmount = 0;
  try {
    previewAmount = minor(amountText);
  } catch {
    /* Invalid amounts are explained by field validation. */
  }
  const person =
    data.members.find((m) => m.id === member)?.name || "this member";
  const unpaid = summary.members[member]?.outstanding || 0;
  const addsFeeCredit =
    kind === "contribution" || (personal && settlement === "contribution");
  let repayAmount = 0;
  try {
    repayAmount = minor(repayAmountText);
  } catch {
    /* Field validation handles invalid input. */
  }
  const lenderBalance = summary.members[repayMember]?.loans || 0;
  const lenderName = data.members.find((m) => m.id === repayMember)?.name || "";
  const applyLenderBalance = applyMember
    ? summary.members[applyMember]?.loans || 0
    : 0;
  async function submitApplyRepayment() {
    if (!record) return;
    setApplyError("");
    if (!applyMember) {
      setApplyError("Choose a lender with an outstanding loan");
      return;
    }
    let cents = 0;
    try {
      cents = minor(applyAmount);
    } catch {
      setApplyError("Enter a valid amount greater than zero");
      return;
    }
    if (cents <= 0) {
      setApplyError("Enter a valid amount greater than zero");
      return;
    }
    if (cents > remainingPayment) {
      setApplyError(
        t(
          "Repayment cannot exceed the remaining unapplied payment of {amount}",
          {
            amount: money(remainingPayment),
          },
        ),
      );
      return;
    }
    if (applyLenderBalance <= 0) {
      setApplyError("Choose a lender with an outstanding loan");
      return;
    }
    if (cents > applyLenderBalance) {
      setApplyError(
        t("Repayment cannot exceed the remaining loan of {amount}", {
          amount: money(applyLenderBalance),
        }),
      );
      return;
    }
    const repayment: Record<string, unknown> = {
      id: applyId,
      type: "loan_repayment",
      amount: applyAmount,
      transaction_date: today() + "T12:00:00+06:00",
      member_id: applyMember,
      paid_by_member_id: null,
      category_id: null,
      funding_source: null,
      personal_settlement: null,
      payment_method: record.payment_method || "cash",
      description: t("Loan repaid from {name}'s payment", {
        name: data.members.find((m) => m.id === record.member_id)?.name || "",
      }),
      notes: withLink("", record.id),
    };
    const done = await onSave(repayment);
    if (done === false) return;
    setApplyOpen(false);
    setApplyAmount("");
  }
  const nextCash =
    summary.funds -
    (useRepayment ? repayAmount : 0) +
    (kind === "contribution" || kind === "loan_received"
      ? previewAmount
      : kind === "loan_repayment" || (kind === "expense" && !personal)
        ? -previewAmount
        : 0);

  return (
    <form
      className="form"
      onSubmit={handleSubmit((v) => {
        if (v.type === "loan_repayment" && minor(v.amount) > balance) {
          setError("amount", {
            message:
              "Repayment exceeds the outstanding loan of " + money(balance),
          });
          return;
        }
        if (useRepayment) {
          if (!repayMember || lenderBalance <= 0) {
            setError("repay_member", {
              message: "Choose a lender with an outstanding loan",
            });
            return;
          }
          if (repayAmount <= 0) {
            setError("repay_amount", {
              message: "Enter a valid amount greater than zero",
            });
            return;
          }
          if (repayAmount > minor(v.amount) || repayAmount > lenderBalance) {
            setError("repay_amount", {
              message:
                "Repayment cannot exceed this payment or the remaining loan",
            });
            return;
          }
        }
        const payment: Record<string, unknown> = {
          type: v.type,
          amount: v.amount,
          transaction_date: (v.date || today()) + "T12:00:00+06:00",
          member_id: v.type === "expense" ? null : v.member_id,
          paid_by_member_id: personal ? v.member_id : null,
          category_id: v.type === "expense" ? v.category_id : null,
          funding_source: v.type === "expense" ? v.funding_source : null,
          personal_settlement: personal ? v.personal_settlement : null,
          payment_method: personal ? null : v.payment_method,
          description: v.description || null,
          notes:
            record && linked ? withLink(v.notes, linked.id) : v.notes || null,
        };
        if (useRepayment) {
          payment.id = linkedIds[0];
          payment.notes = withLink(v.notes, linkedIds[1]);
          onSave([
            payment,
            {
              ...payment,
              id: linkedIds[1],
              type: "loan_repayment",
              amount: v.repay_amount,
              member_id: v.repay_member,
              description: t("Loan repaid from {name}'s payment", {
                name: person,
              }),
              notes: withLink("", linkedIds[0]),
            },
          ]);
        } else onSave(payment);
      })}
    >
      {record?.voided_at && (
        <div className="error-banner">
          {t("Voided:")} {record.void_reason}
        </div>
      )}
      {linked && (
        <div className="info-box linked-payment">
          <span>
            {t("Linked entry")}:{" "}
            {data.members.find((m) => m.id === linked.member_id)?.name} ·{" "}
            {money(minor(linked.amount))}
            {linked.voided_at ? ` · ${t("Voided")}` : ""}
          </span>
          {onLinked && (
            <button
              type="button"
              className="text-button"
              onClick={() => onLinked(linked)}
            >
              {t("View linked entry")}
            </button>
          )}
          <small>{t("Editing or voiding changes only this entry.")}</small>
        </div>
      )}
      {applyCandidate && !record?.voided_at && (
        <div className="repayment-choice">
          {repaymentsOnRecord.length > 0 && (
            <div className="info-box">
              <span>
                {t("Applied to loan repayments:")} {money(allocatedToRecord)}
              </span>
              <small>
                {t("Remaining of this payment: {amount}", {
                  amount: money(remainingPayment),
                })}
              </small>
              {repaymentsOnRecord.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="text-button"
                  onClick={() => onLinked?.(row)}
                >
                  {t("View repayment to {name} · {amount}", {
                    name:
                      data.members.find((m) => m.id === row.member_id)?.name ||
                      "",
                    amount: money(minor(String(row.amount))),
                  })}
                </button>
              ))}
            </div>
          )}
          {!applyOpen ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setApplyOpen(true);
                setApplyError("");
                if (!applyAmount && remainingPayment > 0)
                  setApplyAmount(String(remainingPayment / 100));
                if (!applyMember) {
                  const first = data.members.find(
                    (m) => summary.members[m.id]?.loans > 0,
                  );
                  if (first) setApplyMember(first.id);
                }
              }}
              disabled={remainingPayment <= 0 || summary.loans <= 0}
            >
              {t("Apply to loan repayment")}
            </button>
          ) : (
            <>
              <label>
                {t("Repay to")}
                <select
                  aria-label={t("Repay to")}
                  value={applyMember}
                  onChange={(e) => {
                    setApplyMember(e.target.value);
                    setApplyError("");
                  }}
                >
                  <option value="">{t("Choose a lender")}</option>
                  {data.members
                    .filter((m) => summary.members[m.id]?.loans > 0)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {money(summary.members[m.id].loans)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {t("Repayment amount (BDT)")}
                <input
                  aria-label={t("Repayment amount (BDT)")}
                  inputMode="decimal"
                  value={applyAmount}
                  onChange={(e) => {
                    setApplyAmount(e.target.value);
                    setApplyError("");
                  }}
                />
              </label>
              {applyError && <em>{t(applyError)}</em>}
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setApplyOpen(false);
                    setApplyError("");
                  }}
                >
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={busy}
                  onClick={() => void submitApplyRepayment()}
                >
                  {busy ? t("Saving…") : t("Save repayment")}
                </button>
              </div>
            </>
          )}
          {remainingPayment <= 0 && (
            <p className="form-hint">
              {t("This payment is already fully applied to loan repayments.")}
            </p>
          )}
        </div>
      )}
      <details className="form-guide">
        <summary>{t("How this works")}</summary>
        <p>
          {kind === "contribution"
            ? t("Record money paid toward a member’s entry or weekly fees.")
            : kind === "loan_received"
              ? t(
                  "Record cash a member lent to the club. This does not pay their fees.",
                )
              : kind === "loan_repayment"
                ? t("Record money the club returned to a member who lent it.")
                : t(
                    "Record what was bought, who paid, and how it should count.",
                  )}
        </p>
      </details>
      <label>
        {t("Transaction type")}
        <select {...register("type")} aria-readonly={!!record}>
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v)}
            </option>
          ))}
        </select>
      </label>
      <div className="form-columns">
        <label>
          {t("Amount (BDT)")}
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0.00"
            {...register("amount")}
          />
          {errors.amount && <em>{t(errors.amount.message)}</em>}
        </label>
        <label>
          {kind === "expense" ? t("Date (optional)") : t("Date")}
          <input type="date" {...register("date")} />
          {kind === "expense" && (
            <small>{t("Leave blank to use today.")}</small>
          )}
          {errors.date && <em>{t(errors.date.message)}</em>}
        </label>
      </div>
      {kind === "expense" && (
        <>
          <label>
            {t("Category")}
            <select {...register("category_id")}>
              <option value="">{t("Choose a category")}</option>
              {data.expense_categories
                .filter((c) => c.is_active || c.id === record?.category_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {errors.category_id && <em>{t(errors.category_id.message)}</em>}
          </label>
          <label>
            {t("Who paid?")}
            <select {...register("funding_source")}>
              <option value="group_funds">{t("Club cash")}</option>
              <option value="member_personal">
                {t("A member paid / provided the items")}
              </option>
            </select>
          </label>
        </>
      )}
      {(kind !== "expense" || personal) && (
        <label>
          {kind === "contribution"
            ? t("Member")
            : personal
              ? t("Member who paid")
              : t("Lender")}
          <select {...register("member_id")}>
            <option value="">{t("Choose a member")}</option>
            {data.members
              .filter((m) => m.is_active || m.id === member)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.is_me ? t(" (You)") : ""}
                </option>
              ))}
          </select>
          {errors.member_id && <em>{t(errors.member_id.message)}</em>}
        </label>
      )}
      {kind === "loan_repayment" && (
        <div className="info-box">
          {t("Club still owes this member:")}
          <strong>{money(balance)}</strong>
        </div>
      )}
      {personal ? (
        <>
          <label>
            {t("Should this count as their payment or a loan?")}
            <select {...register("personal_settlement")}>
              <option value="contribution">
                {t("Their entry / weekly fee payment")}
              </option>
              <option value="loan">{t("A loan the club must repay")}</option>
            </select>
          </label>
          <p className="form-hint">
            {t(
              "The purchase is recorded once. No money enters or leaves club cash.",
            )}
          </p>
        </>
      ) : null}
      {!record && kind === "contribution" && summary.loans > 0 && (
        <div className="repayment-choice">
          <label className="checkbox">
            <input
              type="checkbox"
              {...register("use_repayment")}
              onChange={(e) => {
                setValue("use_repayment", e.target.checked);
                if (e.target.checked && !repayAmountText)
                  setValue("repay_amount", amountText);
              }}
            />
            {t("Use this payment to repay a loan")}
          </label>
          {useRepayment && (
            <>
              <label>
                {t("Repay to")}
                <select {...register("repay_member")}>
                  <option value="">{t("Choose a lender")}</option>
                  {data.members
                    .filter((m) => summary.members[m.id].loans > 0)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {money(summary.members[m.id].loans)}
                      </option>
                    ))}
                </select>
                {errors.repay_member && (
                  <em>{t(errors.repay_member.message)}</em>
                )}
              </label>
              <label>
                {t("Repayment amount (BDT)")}
                <input inputMode="decimal" {...register("repay_amount")} />
                {errors.repay_amount && (
                  <em>{t(errors.repay_amount.message)}</em>
                )}
              </label>
            </>
          )}
        </div>
      )}
      <details className="form-guide advanced-fields">
        <summary>{t("Advanced details")}</summary>
        {!personal && (
          <label>
            {t("Payment method")}
            <select {...register("payment_method")}>
              <option value="cash">{t("Cash")}</option>
              <option value="bank_transfer">{t("Bank transfer")}</option>
              <option value="mobile_wallet">{t("Mobile wallet")}</option>
              <option value="other">{t("Other")}</option>
            </select>
          </label>
        )}
        <label>
          {t("Description")}
          <input
            placeholder={t("What was this for?")}
            {...register("description")}
          />
        </label>
        <label>
          {t("Notes (optional)")}
          <textarea
            {...register("notes")}
            placeholder={t("Any extra details…")}
          />
        </label>
      </details>
      {!record?.voided_at && previewAmount > 0 && (
        <div className="live-preview" role="status">
          <strong>{t("After saving this entry")}</strong>
          <p>
            {personal
              ? t("No club cash moves.")
              : t("Cash in hand will be {amount}.", {
                  amount: money(nextCash),
                })}
          </p>
          {addsFeeCredit && member && (
            <p>
              {t("{amount} clears unpaid fees for {name}.", {
                amount: money(Math.min(previewAmount, unpaid)),
                name: person,
              })}{" "}
              {previewAmount > unpaid
                ? t(
                    "{amount} stays as extra fee credit. For money to be returned, record that part separately as a member loan.",
                    { amount: money(previewAmount - unpaid) },
                  )
                : t("{amount} in fees will remain due.", {
                    amount: money(Math.max(0, unpaid - previewAmount)),
                  })}
            </p>
          )}
          {(kind === "loan_received" || (personal && settlement === "loan")) &&
            member && (
              <p>
                {t("The club will owe {name} {amount}.", {
                  name: person,
                  amount: money(balance + previewAmount),
                })}
              </p>
            )}
          {useRepayment && repayMember && (
            <p>
              {t("Repay {name} {amount}; remaining loan {balance}.", {
                name: lenderName,
                amount: money(repayAmount),
                balance: money(Math.max(0, lenderBalance - repayAmount)),
              })}
            </p>
          )}
          {kind === "loan_repayment" && member && (
            <p>
              {t("The club will still owe {name} {amount}.", {
                name: person,
                amount: money(Math.max(0, balance - previewAmount)),
              })}
            </p>
          )}
        </div>
      )}
      {record && isOriginalDateUnknown(record) && (
        <p className="form-hint">
          {t(
            "Original date unknown. This opening record uses its import date. Choose the actual date above if you know it.",
          )}
        </p>
      )}
      {!record?.voided_at && (
        <div className="form-actions">
          {record && (
            <button type="button" className="button danger" onClick={onVoid}>
              {t("Void transaction")}
            </button>
          )}
          <button disabled={busy} className="button primary" type="submit">
            {busy
              ? t("Saving…")
              : record
                ? t("Save changes")
                : t("Save transaction")}
            <Check size={16} />
          </button>
        </div>
      )}
    </form>
  );
}
const memberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().max(40),
  notes: z.string().max(2000),
  membership_type: z.enum(["regular", "temporary"]),
  is_me: z.boolean(),
  is_active: z.boolean(),
});
export function MemberForm({
  record,
  busy,
  onSave,
}: {
  record?: Member;
  busy: boolean;
  onSave: (v: Record<string, unknown>) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: record?.name || "",
      phone: record?.phone || "",
      notes: withoutTemporaryMark(record?.notes),
      membership_type: isTemporaryMember(record || {})
        ? "temporary"
        : "regular",
      is_me: record?.is_me || false,
      is_active: record?.is_active ?? true,
    },
  });
  return (
    <form
      className="form"
      onSubmit={handleSubmit((v) => {
        const { membership_type, ...rest } = v;
        const cleaned = rest.notes.trim();
        onSave({
          ...rest,
          phone: rest.phone || null,
          notes:
            membership_type === "temporary"
              ? withTemporaryMark(cleaned)
              : cleaned || null,
        });
      })}
    >
      <label>
        {t("Full name")}
        <input
          autoFocus
          placeholder={t("Member’s full name")}
          {...register("name")}
        />
        {errors.name && <em>{t(errors.name.message)}</em>}
      </label>
      <label>
        {t("Phone (optional)")}
        <input type="tel" {...register("phone")} />
      </label>
      <fieldset className="choice-group">
        <legend>{t("Membership")}</legend>
        <label className="radio">
          <input
            type="radio"
            value="regular"
            {...register("membership_type")}
          />
          <span>
            <strong>{t("Regular member")}</strong>
            <small>{t("Charged entry or weekly fees.")}</small>
          </span>
        </label>
        <label className="radio">
          <input
            type="radio"
            value="temporary"
            {...register("membership_type")}
          />
          <span>
            <strong>{t("Temporary player")}</strong>
            <small>
              {t(
                "Pays any amount with no obligatory fees. Kept out of dues by default.",
              )}
            </small>
          </span>
        </label>
      </fieldset>
      <label>
        {t("Notes")}
        <textarea {...register("notes")} />
      </label>
      <label className="checkbox">
        <input type="checkbox" {...register("is_active")} />
        {t("Active member")}
      </label>
      <p className="form-hint">
        {t(
          "Uncheck active to archive a member. Their history will be preserved.",
        )}
      </p>
      <button className="button primary" disabled={busy}>
        {busy ? t("Saving…") : t("Save member")}
        <Check size={16} />
      </button>
    </form>
  );
}
export function DuesForm({
  members,
  dues = [],
  busy,
  onSave,
}: {
  members: Member[];
  dues?: Due[];
  busy: boolean;
  onSave: (v: Record<string, unknown>[]) => void;
}) {
  const weeklyTitles = [
    ...new Set(
      dues
        .filter((d) => !d.voided_at && /week/i.test(d.title))
        .map((d) => d.title),
    ),
  ];
  const nextWeek =
    Math.max(
      weeklyTitles.length,
      ...weeklyTitles.map((t) => Number(t.match(/week\s+(\d+)/i)?.[1] || 0)),
    ) + 1;
  const regularIds = members
    .filter((m) => !isTemporaryMember(m))
    .map((m) => m.id);
  const [selected, setSelected] = useState<string[]>(regularIds),
    [amount, setAmount] = useState(""),
    [custom, setCustom] = useState<Record<string, string>>({}),
    [title, setTitle] = useState(`Weekly fee — Week ${nextWeek}`),
    [date, setDate] = useState(today()),
    [error, setError] = useState("");
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          if (!selected.length) throw new Error("Select at least one member.");
          if (!title.trim()) throw new Error("Enter a title.");
          const rows = selected.map((id) => {
            const a = custom[id] || amount;
            if (minor(a) <= 0)
              throw new Error("Amounts must be greater than zero.");
            return {
              member_id: id,
              title: title.trim(),
              amount: a,
              due_date: date || null,
            };
          });
          onSave(rows);
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <p className="form-intro">
        {t("Assign fees for a period. Record payments separately.")}
      </p>
      <div className="fee-presets">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setTitle("Entry fee");
            setAmount("500");
            setSelected((current) =>
              current.filter((id) => regularIds.includes(id)),
            );
          }}
        >
          {t("Entry fee · ৳500")}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setTitle(`Weekly fee — Week ${nextWeek}`);
            setAmount("100");
          }}
        >
          {t("Weekly fee · ৳100")}
        </button>
      </div>
      <label>
        {t("Title")}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
      </label>
      <div className="form-columns">
        <label>
          {t("Default amount (BDT)")}
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
          />
        </label>
        <label>
          {t("Due date")}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={
            regularIds.length > 0 &&
            regularIds.every((id) => selected.includes(id))
          }
          onChange={(e) =>
            setSelected(
              e.target.checked
                ? [
                    ...selected.filter((id) => !regularIds.includes(id)),
                    ...regularIds,
                  ]
                : selected.filter((id) => !regularIds.includes(id)),
            )
          }
        />
        {t("Select all regular members")}
      </label>
      <div className="dues-selection">
        {members.map((m) => (
          <div key={m.id}>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={(e) =>
                  setSelected((p) =>
                    e.target.checked
                      ? [...p, m.id]
                      : p.filter((id) => id !== m.id),
                  )
                }
              />
              {m.name}
              {isTemporaryMember(m) && (
                <span className="badge neutral temporary-badge">
                  {t("Temporary")}
                </span>
              )}
            </label>
            <input
              aria-label={t("Custom amount for {name}", { name: m.name })}
              inputMode="decimal"
              placeholder={amount || t("Custom amount")}
              value={custom[m.id] || ""}
              onChange={(e) =>
                setCustom((p) => ({ ...p, [m.id]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <div className="live-preview">
        <strong>{t("Review new charges")}</strong>
        <p>
          {title} · {selected.length} {t("selected members")}
        </p>
        {selected.map((id) => {
          const a = custom[id] || amount;
          let cents = 0;
          try {
            cents = minor(a);
          } catch {
            /* Await a valid amount. */
          }
          return (
            <div className="fee-preview-row" key={id}>
              <span>{members.find((m) => m.id === id)?.name}</span>
              <strong>{cents ? money(cents) : t("Enter amount")}</strong>
            </div>
          );
        })}
        <p>
          {t(
            "Assigning twice adds the fees twice. Check the period before saving.",
          )}
        </p>
      </div>
      {error && <em>{t(error)}</em>}
      <button className="button primary" disabled={busy || !members.length}>
        {busy
          ? t("Assigning…")
          : t("Assign dues to {count} members", { count: selected.length })}
      </button>
    </form>
  );
}
export function CategoryForm({
  record,
  busy,
  onSave,
}: {
  record?: Category;
  busy: boolean;
  onSave: (v: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          name: String(f.get("name")).trim(),
          sort_order: Number(f.get("sort_order")),
          is_active: f.get("is_active") === "on",
        });
      }}
    >
      <label>
        {t("Category name")}
        <input
          required
          name="name"
          defaultValue={record?.name}
          maxLength={100}
        />
      </label>
      <label>
        {t("Display order")}
        <input
          name="sort_order"
          type="number"
          min="0"
          step="1"
          defaultValue={record?.sort_order || 0}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={record?.is_active ?? true}
        />
        {t("Active")}
      </label>
      <button className="button primary" disabled={busy}>
        {busy ? t("Saving…") : t("Save category")}
      </button>
    </form>
  );
}
export function VoidForm({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (reason: string) => void;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const reason = String(
          new FormData(e.currentTarget).get("reason"),
        ).trim();
        if (reason) onSave(reason);
      }}
    >
      <p>
        {t(
          "This entry will be excluded from all balances. Its original details and your reason remain in the history.",
        )}
      </p>
      <label>
        {t("Reason")}
        <textarea
          required
          name="reason"
          minLength={3}
          maxLength={1000}
          placeholder={t("Why is this transaction being voided?")}
        />
      </label>
      <button className="button danger" disabled={busy}>
        {busy ? t("Voiding…") : t("Confirm void transaction")}
      </button>
    </form>
  );
}
