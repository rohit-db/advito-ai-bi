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
  indigo: "bg-primary/10 text-primary",
  emerald: "bg-[var(--background-success)] text-[var(--success)]",
  slate: "bg-muted text-muted-foreground",
};

export default function StatCard({ label, value, hint, icon, accent = "slate" }: StatCardProps) {
  return (
    <div className="flex items-center gap-3.5 rounded-md border border-border bg-background px-4 py-3.5 shadow-[var(--shadow-db-sm)]">
      {icon && (
        <div
          className={cn(
            "w-10 h-10 rounded-md flex items-center justify-center shrink-0",
            accentClasses[accent]
          )}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold text-foreground leading-tight truncate">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</div>}
      </div>
    </div>
  );
}
