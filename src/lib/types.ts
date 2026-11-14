export type Kind =
  "contribution" | "expense" | "loan_received" | "loan_repayment";
export interface Member {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  is_me: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface Category {
  id: string;
  owner_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}
export interface Due {
  id: string;
  owner_id: string;
  member_id: string;
  title: string;
  amount: number | string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  voided_at: string | null;
}
export interface Transaction {
  id: string;
  owner_id: string;
  type: Kind;
  amount: number | string;
  transaction_date: string;
  member_id: string | null;
  paid_by_member_id: string | null;
  category_id: string | null;
  funding_source: "group_funds" | "member_personal" | null;
  personal_settlement: "contribution" | "loan" | null;
  payment_method: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  voided_at: string | null;
  void_reason: string | null;
}
export interface Ledger {
  members: Member[];
  expense_categories: Category[];
  dues: Due[];
  transactions: Transaction[];
}
