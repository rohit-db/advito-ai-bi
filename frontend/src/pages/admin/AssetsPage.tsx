import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Plus, RefreshCw } from "lucide-react";
import * as adminApi from "@/lib/adminApi";
import type { AssetRow, SaveAssetBody } from "@/lib/adminApi";
import { Spinner } from "@/components/admin/shared";
import AssetEditor from "@/components/admin/AssetEditor";
import AssetCard from "@/components/admin/AssetCard";
import { useAdminOutlet, ADMIN_ACCESS_PATH } from "@/components/admin/adminContext";

export default function AssetsPage() {
  const { reportAccessError } = useAdminOutlet();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [writable, setWritable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AssetRow | null | "create">(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
    try {
      await adminApi.saveAdminAsset(body);
    } catch (err) {
      reportAccessError(err);   // flip the 401/403 gate like the other mutations
      throw err;                // re-throw so AssetEditor still surfaces a 400 message
    }
    setEditing(null);
    await load();
  }, [load, reportAccessError]);

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

  const activeCount = assets.filter((a) => a.active).length;
  const pageCount = assets.reduce((n, a) => n + (a.spec.pages?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[var(--shadow-db-sm)]">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Manage Assets</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Dashboards, Genie prompts, and per-tenant access. Assets resolve from the registry; changes apply on next load.
            </p>
          </div>
        </div>
        <button onClick={load} title="Refresh"
          className="mt-1 inline-flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-[var(--shadow-db-sm)] hover:bg-[var(--action-default-bg-hover)]">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && <div className="rounded border border-[var(--border-danger)] bg-[var(--background-danger)] px-3 py-2 text-sm text-destructive">{error}</div>}

      {/* Asset grid */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dashboard assets</h2>
          <button onClick={() => setEditing("create")} disabled={!writable}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-db-sm)] hover:bg-blue-700 disabled:opacity-50">
            <Plus size={13} /> Add asset
          </button>
        </div>

        {!writable && (
          <div className="rounded border border-[var(--border-warning)] bg-[var(--background-warning)] px-3 py-2 text-xs text-[var(--warning)]">
            Editing assets requires Lakebase. Edit <code className="font-mono">server/assets/dashboards.seed.json</code> (or enable Lakebase) — changes appear on reload.
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground"><Spinner size={20} /><span className="text-xs">Loading assets…</span></div>
        ) : assets.length === 0 ? (
          <p className="rounded border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">No assets configured.</p>
        ) : (
          <>
            {/* Stat strip */}
            <div className="flex items-center gap-4 rounded border border-border bg-secondary px-4 py-2">
              <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{activeCount}</span> active</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{assets.length}</span> total</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{pageCount}</span> pages</span>
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((a) => (
                <AssetCard
                  key={a.asset_key}
                  asset={a}
                  writable={writable}
                  busy={busyKey === a.asset_key}
                  onEdit={() => setEditing(a)}
                  onAccess={() => navigate(ADMIN_ACCESS_PATH)}
                  onToggleActive={() => onToggleActive(a)}
                  onDelete={() => onDelete(a)}
                />
              ))}
              {/* Dashed add tile */}
              <button
                aria-label="Create a new asset"
                onClick={() => setEditing("create")}
                disabled={!writable}
                className="flex min-h-[120px] items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} /> Add asset
              </button>
            </div>
          </>
        )}
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
