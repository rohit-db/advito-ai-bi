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
      icon={<AlertTriangle size={18} className={danger ? "text-rose-600" : "text-brand-primary"} />}
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
            className={cn(danger && "bg-rose-600 hover:bg-rose-700")}
          >
            {busy && <Spinner size={14} className="text-white" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-600 leading-relaxed">{message}</div>
      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
    </Modal>
  );
}
