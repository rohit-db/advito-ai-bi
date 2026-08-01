import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal, Spinner } from "./shared";

export interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = "default",
  busy,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const danger = tone === "danger";
  return (
    <Modal
      title={title}
      icon={<AlertTriangle size={18} className={danger ? "text-destructive" : "text-primary"} />}
      onClose={onClose}
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button variant="default" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={busy}
            className={cn(danger && "bg-destructive hover:bg-red-700")}
          >
            {busy && <Spinner size={14} className="text-white" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted-foreground leading-relaxed">{message}</div>
      {error && (
        <div className="mt-3 rounded border border-[var(--border-danger)] bg-[var(--background-danger)] px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </Modal>
  );
}
