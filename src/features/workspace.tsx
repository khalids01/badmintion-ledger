import type { LedgerWorkspace } from "./use-ledger";
import { HomePage } from "./home-page";
import { MembersPage } from "./members-page";
import { TransactionsPage } from "./transactions-page";
import { ReportsPage } from "./reports-page";
import { SettingsPage } from "./settings-page";
import type { Member, Transaction, Category } from "../lib/types";
import type { Session } from "@supabase/supabase-js";

export function WorkspaceView({
  workspace,
  session,
  readOnly,
  onOpenCash,
  onOpenLoans,
  onOpenMember,
  onRecordPayment,
  onOpenAddExpense,
  onOpenAssignDues,
  onOpenAddMember,
  onOpenTx,
  onLogout,
  onSelectMyMember,
  onExportTransactions,
  onExportMembers,
  onOpenCategory,
  onSeedCategories,
}: {
  workspace: LedgerWorkspace;
  session: Session;
  readOnly?: boolean;
  onOpenCash: () => void;
  onOpenLoans: () => void;
  onOpenMember: (member: Member) => void;
  onRecordPayment: () => void;
  onOpenAddExpense: () => void;
  onOpenAssignDues: () => void;
  onOpenAddMember: () => void;
  onOpenTx: (tx: Transaction) => void;
  onLogout: () => void;
  onSelectMyMember: (id: string) => void;
  onExportTransactions: () => void;
  onExportMembers: () => void;
  onOpenCategory: (record?: Category) => void;
  onSeedCategories: () => void;
}) {
  const { page } = workspace;
  switch (page) {
    case "Home":
      return (
        <HomePage
          workspace={workspace}
          readOnly={readOnly}
          onOpenCash={onOpenCash}
          onOpenLoans={onOpenLoans}
          onOpenMember={onOpenMember}
          onRecordPayment={onRecordPayment}
          onOpenAddExpense={onOpenAddExpense}
          onOpenTx={onOpenTx}
        />
      );
    case "Members":
      return (
        <MembersPage
          workspace={workspace}
          readOnly={readOnly}
          onOpenMember={onOpenMember}
          onAddMember={readOnly ? undefined : onOpenAddMember}
          onAssignDues={readOnly ? undefined : onOpenAssignDues}
        />
      );
    case "Transactions":
      return (
        <TransactionsPage
          workspace={workspace}
          readOnly={readOnly}
          onOpenTx={onOpenTx}
          onExport={onExportTransactions}
        />
      );
    case "Reports":
      return (
        <ReportsPage
          workspace={workspace}
          onExportTransactions={readOnly ? undefined : onExportTransactions}
          onExportMembers={readOnly ? undefined : onExportMembers}
          onOpenTx={onOpenTx}
        />
      );
    case "Settings":
      return (
        <SettingsPage
          workspace={workspace}
          session={session}
          readOnly={readOnly}
          onLogout={onLogout}
          onSelectMyMember={readOnly ? undefined : onSelectMyMember}
          onExportTransactions={readOnly ? undefined : onExportTransactions}
          onExportMembers={readOnly ? undefined : onExportMembers}
          onOpenCategory={readOnly ? undefined : onOpenCategory}
          onSeedCategories={readOnly ? undefined : onSeedCategories}
        />
      );
  }
}
