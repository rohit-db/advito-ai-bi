import { LayoutDashboard, Pencil, Trash2, ShieldCheck } from "lucide-react";
import type { AssetRow } from "@/lib/adminApi";

export default function AssetCard({
  asset, writable, busy, onEdit, onAccess, onToggleActive, onDelete,
}: {
  asset: AssetRow; writable: boolean; busy: boolean;
  onEdit: () => void; onAccess: () => void; onToggleActive: () => void; onDelete: () => void;
}) {
  const pageCount = asset.spec.pages?.length ?? 0;
  const filterCount = Object.keys(asset.spec.filters ?? {}).length;
  const meta = `${asset.asset_key} · ${pageCount} page${pageCount === 1 ? "" : "s"} · ${filterCount} filter${filterCount === 1 ? "" : "s"}`;
  return (
    <div className={`rounded-md border border-border bg-background p-4 shadow-[var(--shadow-db-sm)] ${asset.active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded bg-primary text-primary-foreground">
          <LayoutDashboard size={18} />
        </div>
        <button onClick={onToggleActive} disabled={!writable || busy}
          aria-label={asset.active ? "Deactivate asset" : "Activate asset"}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium disabled:opacity-60 ${asset.active ? "bg-[var(--background-success)] text-[var(--success)]" : "bg-muted text-muted-foreground"}`}>
          {asset.active ? "Active" : "Inactive"}
        </button>
      </div>
      <div className="mt-2.5 text-sm font-semibold text-foreground">{asset.spec.label}</div>
      <div className="font-mono text-[11px] text-muted-foreground">{meta}</div>
      <div className="mt-3 flex items-center gap-1.5">
        <button onClick={onEdit} disabled={!writable || busy}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
          <Pencil size={13} /> Edit
        </button>
        <button onClick={onAccess}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-[var(--action-default-bg-hover)]">
          <ShieldCheck size={13} /> Access
        </button>
        <button aria-label="Delete asset" onClick={onDelete} disabled={!writable || busy}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-[var(--action-default-bg-hover)] hover:text-destructive disabled:opacity-40">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
