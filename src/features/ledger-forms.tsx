import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { calculate, minor, money, today } from "../lib/accounting";
import type { Ledger, Kind, Transaction, Member, Category } from "../lib/types";
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
    date: z.string().min(1, "Select a date"),
    member_id: z.string(),
    category_id: z.string(),
    funding_source: z.enum(["group_funds", "member_personal"]),
    personal_settlement: z.enum(["contribution", "loan"]),
    payment_method: z.string(),
    description: z.string().max(250),
    notes: z.string().max(2000),
  })
  .superRefine((v, ctx) => {
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
  busy,
  onSave,
  onVoid,
}: {
  data: Ledger;
  type: Kind;
  record?: Transaction;
  busy: boolean;
  onSave: (v: Record<string, unknown>) => void;
  onVoid: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setError,
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
      member_id: record?.member_id || record?.paid_by_member_id || "",
      category_id:
        record?.category_id ||
        data.expense_categories.filter((c) => c.is_active)[0]?.id ||
        "",
      funding_source: record?.funding_source || "group_funds",
      personal_settlement: record?.personal_settlement || "contribution",
      payment_method: record?.payment_method || "cash",
      description: record?.description || "",
      notes: record?.notes || "",
    },
  });
  const kind = watch("type"),
    personal =
      kind === "expense" && watch("funding_source") === "member_personal",
    member = watch("member_id");
  const adjusted = {
      ...data,
      transactions: data.transactions.filter((t) => t.id !== record?.id),
    },
    balance = calculate(adjusted).members[member]?.loans || 0;
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
        onSave({
          type: v.type,
          amount: v.amount,
          transaction_date: v.date + "T12:00:00+06:00",
          member_id: v.type === "expense" ? null : v.member_id,
          paid_by_member_id: personal ? v.member_id : null,
          category_id: v.type === "expense" ? v.category_id : null,
          funding_source: v.type === "expense" ? v.funding_source : null,
          personal_settlement: personal ? v.personal_settlement : null,
          payment_method: personal ? null : v.payment_method,
          description: v.description || null,
          notes: v.notes || null,
        });
      })}
    >
      {record?.voided_at && (
        <div className="error-banner">Voided: {record.void_reason}</div>
      )}
      <label>
        Transaction type
        <select {...register("type")} aria-readonly={!!record}>
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <div className="form-columns">
        <label>
          Amount (BDT)
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0.00"
            {...register("amount")}
          />
          {errors.amount && <em>{errors.amount.message}</em>}
        </label>
        <label>
          Date
          <input type="date" {...register("date")} />
          {errors.date && <em>{errors.date.message}</em>}
        </label>
      </div>
      {kind === "expense" && (
        <>
          <label>
            Category
            <select {...register("category_id")}>
              <option value="">Choose a category</option>
              {data.expense_categories
                .filter((c) => c.is_active || c.id === record?.category_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {errors.category_id && <em>{errors.category_id.message}</em>}
          </label>
          <label>
            Paid using
            <select {...register("funding_source")}>
              <option value="group_funds">Group funds</option>
              <option value="member_personal">Member’s personal money</option>
            </select>
          </label>
        </>
      )}
      {(kind !== "expense" || personal) && (
        <label>
          {kind === "contribution"
            ? "Member"
            : personal
              ? "Member who paid"
              : "Lender"}
          <select {...register("member_id")}>
            <option value="">Choose a member</option>
            {data.members
              .filter((m) => m.is_active || m.id === member)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.is_me ? " (You)" : ""}
                </option>
              ))}
          </select>
          {errors.member_id && <em>{errors.member_id.message}</em>}
        </label>
      )}
      {kind === "loan_repayment" && (
        <div className="info-box">
          Outstanding loan: <strong>{money(balance)}</strong>
        </div>
      )}
      {personal ? (
        <>
          <label>
            Count this purchase as
            <select {...register("personal_settlement")}>
              <option value="contribution">Member contribution</option>
              <option value="loan">Loan to the group</option>
            </select>
          </label>
          <p className="form-hint">
            Recorded once as an expense. Group funds remain unchanged.
          </p>
        </>
      ) : (
        <label>
          Payment method
          <select {...register("payment_method")}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="mobile_wallet">Mobile wallet</option>
            <option value="other">Other</option>
          </select>
        </label>
      )}
      <label>
        Description
        <input placeholder="What was this for?" {...register("description")} />
      </label>
      <label>
        Notes (optional)
        <textarea {...register("notes")} placeholder="Any extra details…" />
      </label>
      {!record?.voided_at && (
        <div className="form-actions">
          {record && (
            <button type="button" className="button danger" onClick={onVoid}>
              Void transaction
            </button>
          )}
          <button disabled={busy} className="button primary" type="submit">
            {busy ? "Saving…" : record ? "Save changes" : "Save transaction"}
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
      notes: record?.notes || "",
      is_me: record?.is_me || false,
      is_active: record?.is_active ?? true,
    },
  });
  return (
    <form
      className="form"
      onSubmit={handleSubmit((v) =>
        onSave({ ...v, phone: v.phone || null, notes: v.notes || null }),
      )}
    >
      <label>
        Full name
        <input
          autoFocus
          placeholder="Member’s full name"
          {...register("name")}
        />
        {errors.name && <em>{errors.name.message}</em>}
      </label>
      <label>
        Phone (optional)
        <input type="tel" {...register("phone")} />
      </label>
      <label>
        Notes
        <textarea {...register("notes")} />
      </label>
      <label className="checkbox">
        <input type="checkbox" {...register("is_me")} />
        This is me (the administrator)
      </label>
      <label className="checkbox">
        <input type="checkbox" {...register("is_active")} />
        Active member
      </label>
      <p className="form-hint">
        Uncheck active to archive a member. Their history will be preserved.
      </p>
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Save member"}
        <Check size={16} />
      </button>
    </form>
  );
}
export function DuesForm({
  members,
  busy,
  onSave,
}: {
  members: Member[];
  busy: boolean;
  onSave: (v: Record<string, unknown>[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(members.map((m) => m.id)),
    [amount, setAmount] = useState(""),
    [custom, setCustom] = useState<Record<string, string>>({}),
    [title, setTitle] = useState("Monthly contribution"),
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
      <label>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
      </label>
      <div className="form-columns">
        <label>
          Default amount (BDT)
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
          />
        </label>
        <label>
          Due date
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
          checked={selected.length === members.length}
          onChange={(e) =>
            setSelected(e.target.checked ? members.map((m) => m.id) : [])
          }
        />
        Select all active members
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
            </label>
            <input
              aria-label={"Custom amount for " + m.name}
              inputMode="decimal"
              placeholder={amount || "Custom amount"}
              value={custom[m.id] || ""}
              onChange={(e) =>
                setCustom((p) => ({ ...p, [m.id]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <p className="form-hint">
        Set a different amount beside any member. Contributions determine their
        paid status automatically.
      </p>
      {error && <em>{error}</em>}
      <button className="button primary" disabled={busy || !members.length}>
        {busy ? "Assigning…" : "Assign dues to " + selected.length + " members"}
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
        Category name
        <input
          required
          name="name"
          defaultValue={record?.name}
          maxLength={100}
        />
      </label>
      <label>
        Display order
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
        Active
      </label>
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Save category"}
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
        This entry will be excluded from all balances. Its original details and
        your reason remain in the history.
      </p>
      <label>
        Reason
        <textarea
          required
          name="reason"
          minLength={3}
          maxLength={1000}
          placeholder="Why is this transaction being voided?"
        />
      </label>
      <button className="button danger" disabled={busy}>
        {busy ? "Voiding…" : "Confirm void transaction"}
      </button>
    </form>
  );
}
