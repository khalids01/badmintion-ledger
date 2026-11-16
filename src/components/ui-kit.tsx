import { t } from "../lib/i18n";
import { Receipt } from "lucide-react";
import type { ReactNode } from "react";

export function Avatar({
  name,
  size = "md",
  index = 0,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  index?: number;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={`avatar avatar-${size} color-${index % 4}`}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Receipt size={25} />
      <h3>{t(title)}</h3>
      <p>{t(text)}</p>
    </div>
  );
}

export function PanelTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h3>{t(title)}</h3>
        {subtitle ? <p>{t(subtitle)}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function MemberBadge({
  outstanding,
  assigned,
  credit,
}: {
  outstanding: number;
  assigned: number;
  credit: number;
}) {
  if (!assigned) return <span className="badge neutral">{t("No dues")}</span>;
  if (!outstanding) return <span className="badge paid">{t("Paid")}</span>;
  if (credit)
    return <span className="badge partial">{t("Partially paid")}</span>;
  return <span className="badge unpaid">{t("Unpaid")}</span>;
}
