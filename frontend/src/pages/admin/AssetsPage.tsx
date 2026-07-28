import { useCallback, useEffect, useState } from "react";
import { LayoutDashboard, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import * as adminApi from "@/lib/adminApi";
import type { AssetRow, SaveAssetBody } from "@/lib/adminApi";
import { Spinner } from "@/components/admin/shared";
import AssetEditor from "@/components/admin/AssetEditor";
import AccessGrid from "@/components/admin/AccessGrid";
import { useAdminOutlet } from "@/components/admin/adminContext";

export default function AssetsPage() {
  const { reportAccessError } = useAdminOutlet();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [writable, setWritable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AssetRow | null | "create">(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.listAdminAssets();
      setAssets(res.assets ?? []);
      setWritable(!!res.writable);
      setError(null);
    } catch (err) {
      reportAccessError(err);
      setError(err instanceof Error ? err.message : "Could not load assets");
    } finally {
      setLoading(false);
    }
  }, [reportAccessError]);

  useEffect(() => { load(); }, [load]);

  const onSave = useCallback(async (body: SaveAssetBody) => {
    await adminApi.saveAdminAsset(body); // throws on 400 -> surfaced by AssetEditor
    setEditing(null);
    await load();
  }, [load]);

  const onToggleActive = useCallback(async (row: AssetRow) => {
    setBusyKey(row.asset_key);
    try {
      await adminApi.saveAdminAsset({ asset_key: row.asset_key, spec: row.spec, sort_order: row.sort_order, active: !row.active });
      await load();
    } catch (err) {
      reportAccessError(err);
      setError(err instanceof Error ? err.message : "Could not update asset");
    } finally {
      setBusyKey(null);
    }
  }, [load, reportAccessError]);

  const onDelete = useCallback(async (row: AssetRow) => {
    if (!window.confirm(`Delete asset "${row.asset_key}"? This removes it from the app on next load.`)) return;
    setBusyKey(row.asset_key);
    try {
      await adminApi.deleteAdminAsset(row.asset_key);
      await load();
    } catch (err) {
      reportAccessError(err);
      setError(err instanceof Error ? err.message : "Could not delete asset");
    } finally {
      setBusyKey(null);
    }
  }, [load, reportAccessError]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-brand-primary to-brand-accent text-white shadow-sm">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">Manage Assets</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
              Dashboards, Genie prompts, and per-tenant access. Assets resolve from the registry; changes apply on next load.
            </p>
          </div>
        </div>
        <button onClick={load} title="Refresh"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* Registry table */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dashboard assets</h2>
          <button onClick={() => setEditing("create")} disabled={!writable}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-primary-dark disabled:opacity-50">
            <Plus size={13} /> Add asset
          </button>
        </div>

        {!writable && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Editing assets requires Lakebase. Edit <code className="font-mono">server/assets/dashboards.seed.json</code> (or enable Lakebase) — changes appear on reload.
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-slate-400"><Spinner size={20} /><span className="text-xs">Loading assets…</span></div>
        ) : assets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-brand-border px-3 py-4 text-xs text-slate-400">No assets configured.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-brand-border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Key</th><th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2">Dashboard id</th><th className="px-3 py-2">Pages</th>
                  <th className="px-3 py-2">Active</th><th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((a) => (
                  <tr key={a.asset_key} className={a.active ? "" : "opacity-50"}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{a.asset_key}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{a.spec.label}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{a.spec.dashboardId}</td>
                    <td className="px-3 py-2 text-slate-600">{a.spec.pages?.length ?? 0}</td>
                    <td className="px-3 py-2">
                      <button disabled={!writable || busyKey === a.asset_key} onClick={() => onToggleActive(a)}
                        className="text-xs font-medium text-brand-primary hover:text-brand-primary-dark disabled:opacity-50">
                        {a.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button aria-label="Edit asset" disabled={!writable} onClick={() => setEditing(a)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-primary disabled:opacity-40"><Pencil size={14} /></button>
                        <button aria-label="Delete asset" disabled={!writable || busyKey === a.asset_key} onClick={() => onDelete(a)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 disabled:opacity-40"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Access grid */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant access</h2>
        <AccessGrid onAccessError={reportAccessError} />
      </section>

      {editing && (
        <AssetEditor
          initial={editing === "create" ? null : editing}
          existingKeys={assets.map((a) => a.asset_key)}
          onSave={onSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
