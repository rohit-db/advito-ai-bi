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
    <div className={`rounded-xl border border-brand-border bg-white p-4 shadow-sm ${asset.active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-brand-primary to-brand-accent text-white">
          <LayoutDashboard size={18} />
        </div>
        <button onClick={onToggleActive} disabled={!writable || busy}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium disabled:opacity-60 ${asset.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
          {asset.active ? "Active" : "Inactive"}
        </button>
      </div>
      <div className="mt-2.5 text-sm font-semibold text-slate-900">{asset.spec.label}</div>
      <div className="font-mono text-[11px] text-slate-400">{meta}</div>
      <div className="mt-3 flex items-center gap-1.5">
        <button onClick={onEdit} disabled={!writable}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-brand-primary-light px-2 py-1.5 text-xs font-medium text-brand-primary-dark hover:bg-brand-primary hover:text-white disabled:opacity-50">
          <Pencil size={13} /> Edit
        </button>
        <button onClick={onAccess}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-brand-border px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          <ShieldCheck size={13} /> Access
        </button>
        <button aria-label="Delete asset" onClick={onDelete} disabled={!writable || busy}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 disabled:opacity-40">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
