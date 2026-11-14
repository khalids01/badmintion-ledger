import type { Kind } from "./types";
export const labels: Record<Kind, string> = {
  contribution: "Fee payment",
  expense: "Purchase / expense",
  loan_received: "Member lent money to club",
  loan_repayment: "Club repaid a member",
};
