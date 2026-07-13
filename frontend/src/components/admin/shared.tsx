import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// =============================================================================
// Shared admin UI primitives
//
// The app ships no dialog/table/card primitive, so these are the plain-Tailwind
// building blocks the Service Principals admin page composes from. They match the
// app's visual language: white surfaces, slate borders, rounded-2xl panels,
// shadow-2xl overlays, indigo accents.
// =============================================================================

// ─── Time formatting ─────────────────────────────────────────────────────────

/** Human "3m ago" style relative time; falls back to the raw string on parse error. */
export function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 0) return "just now";
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

/** Full local timestamp used in tooltips / detail views. */
export function formatAbsolute(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

// ─── Copy button ─────────────────────────────────────────────────────────────

export function CopyButton({
  value,
  label,
  className,
  size = 14,
}: {
  value: string;
  label?: string;
  className?: string;
  size?: number;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : `Copy${label ? ` ${label}` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-slate-400",
        "hover:bg-slate-100 hover:text-slate-600 transition-colors",
        className
      )}
    >
      {copied ? <Check size={size} className="text-emerald-500" /> : <Copy size={size} />}
      {label && <span className="text-xs font-medium">{copied ? "Copied" : label}</span>}
    </button>
  );
}

// ─── Monospace value with copy ───────────────────────────────────────────────

export function MonoValue({
  value,
  truncate,
  className,
}: {
  value: string;
  truncate?: boolean;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
      <code
        title={value}
        className={cn(
          "font-mono text-[11px] text-slate-500",
          truncate && "truncate max-w-[160px]",
          className
        )}
      >
        {value}
      </code>
      <CopyButton value={value} />
    </span>
  );
}

// ─── Status badges ───────────────────────────────────────────────────────────

export function TenantStatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <Badge
      className={cn(
        "gap-1.5",
        active
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-slate-100 text-slate-600 border border-slate-200"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-slate-400"
        )}
      />
      {active ? "Active" : status === "deactivated" ? "Deactivated" : status}
    </Badge>
  );
}

export function AuditStatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const ok = s === "ok" || s === "success" || s === "passed" || s === "active";
  const failed = s === "error" || s === "failed" || s === "fail";
  return (
    <Badge
      className={cn(
        "text-[10px] px-2 py-0.5",
        ok
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : failed
          ? "bg-rose-50 text-rose-700 border border-rose-200"
          : "bg-slate-100 text-slate-600 border border-slate-200"
      )}
    >
      {status || "—"}
    </Badge>
  );
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-lg",
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden",
          maxWidthClass
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Right-side drawer shell ─────────────────────────────────────────────────

export function Drawer({
  title,
  subtitle,
  icon,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md flex flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ─── Small inline spinner ────────────────────────────────────────────────────

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cn("animate-spin text-indigo-500", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
