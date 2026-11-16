import { useState } from "react";
import { t } from "../lib/i18n";
import type { Kind } from "../lib/types";
import {
  ChevronRight,
  ChevronLeft,
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Banknote,
} from "lucide-react";

export function AddSheet({
  onPick,
}: {
  onPick: (choice: { type: Kind; personal?: boolean } | "dues") => void;
}) {
  const [step, setStep] = useState<"menu" | "borrow">("menu");

  if (step === "borrow") {
    return (
      <div className="add-options">
        <button className="add-option" onClick={() => setStep("menu")}>
          <span className="tx-icon loan_received" aria-hidden="true">
            <ChevronLeft size={21} />
          </span>
          <span className="option-main">
            <strong>{t("Back")}</strong>
            <small>{t("Borrow or repay")}</small>
          </span>
        </button>
        <button
          className="add-option"
          onClick={() => onPick({ type: "loan_received" })}
        >
          <span className="tx-icon loan_received" aria-hidden="true">
            <HandCoins size={21} />
          </span>
          <span className="option-main">
            <strong>{t("A member lent money")}</strong>
            <small>{t("The club receives cash it must repay later.")}</small>
          </span>
          <ChevronRight size={19} />
        </button>
        <button
          className="add-option"
          onClick={() => onPick({ type: "loan_repayment" })}
        >
          <span className="tx-icon loan_repayment" aria-hidden="true">
            <ArrowDownLeft size={21} />
          </span>
          <span className="option-main">
            <strong>{t("The club repaid someone")}</strong>
            <small>{t("Return part or all of a member’s loan.")}</small>
          </span>
          <ChevronRight size={19} />
        </button>
      </div>
    );
  }

  return (
    <div className="add-options">
      <button
        className="add-option"
        onClick={() => onPick({ type: "contribution" })}
      >
        <span className="tx-icon contribution" aria-hidden="true">
          <ArrowDownLeft size={21} />
        </span>
        <span className="option-main">
          <strong>{t("Collect money")}</strong>
          <small>{t("A member paid entry or weekly fees.")}</small>
        </span>
        <ChevronRight size={19} />
      </button>
      <button
        className="add-option"
        onClick={() => onPick({ type: "expense" })}
      >
        <span className="tx-icon expense" aria-hidden="true">
          <ArrowUpRight size={21} />
        </span>
        <span className="option-main">
          <strong>{t("Add expense")}</strong>
          <small>{t("An expense paid from club cash.")}</small>
        </span>
        <ChevronRight size={19} />
      </button>
      <button className="add-option" onClick={() => setStep("borrow")}>
        <span className="tx-icon loan_received" aria-hidden="true">
          <HandCoins size={21} />
        </span>
        <span className="option-main">
          <strong>{t("Borrow or repay")}</strong>
          <small>{t("A member lent money or the club repaid a member")}</small>
        </span>
        <ChevronRight size={19} />
      </button>
      <button className="add-option" onClick={() => onPick("dues")}>
        <span className="tx-icon dues" aria-hidden="true">
          <Banknote size={21} />
        </span>
        <span className="option-main">
          <strong>{t("Assign dues")}</strong>
          <small>{t("Charge entry or weekly fees to members")}</small>
        </span>
        <ChevronRight size={19} />
      </button>
      <p className="form-hint" style={{ padding: "2px 4px" }}>
        {t(
          "For member-provided items, choose “Add expense” and pick “A member paid / provided the items”.",
        )}
      </p>
    </div>
  );
}
