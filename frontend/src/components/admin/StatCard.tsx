import React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "indigo" | "emerald" | "slate";
}

const accentClasses: Record<NonNullable<StatCardProps["accent"]>, string> = {
  indigo: "bg-brand-primary-light text-brand-primary",
  emerald: "bg-emerald-50 text-emerald-600",
  slate: "bg-slate-100 text-slate-500",
};

export default function StatCard({ label, value, hint, icon, accent = "slate" }: StatCardProps) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      {icon && (
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            accentClasses[accent]
          )}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-xl font-semibold text-slate-900 leading-tight truncate">{value}</div>
        {hint && <div className="text-[11px] text-slate-400 mt-0.5 truncate">{hint}</div>}
      </div>
    </div>
  );
}
