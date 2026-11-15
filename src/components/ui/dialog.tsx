import { LanguageControl } from "../../features/language";
import { t } from "../../lib/i18n";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <LanguageControl compact />
            <Dialog.Close className="icon-button" aria-label={t("Close")}>
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {t("Manage your badminton ledger records.")}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
