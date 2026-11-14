import type { Ledger } from "./types";
export const categoryNames = [
  "Court / Venue",
  "Shuttlecocks",
  "Net & Equipment",
  "Tape & Accessories",
  "Lighting / Electricity",
  "Repairs & Maintenance",
  "Tournament / Entry Fees",
  "Other",
];
export const empty: Ledger = {
  members: [],
  expense_categories: [],
  dues: [],
  transactions: [],
};
