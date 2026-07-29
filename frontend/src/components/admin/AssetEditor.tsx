import { useEffect, useState } from "react";
import { Plus, Trash2, LayoutDashboard } from "lucide-react";
import { Modal } from "./shared";
import { FILTERS, ICON_MAP } from "@/config";
import type { FilterKey, RouteSection } from "@/config";
import type { AssetPage } from "@/registry/types";
import * as adminApi from "@/lib/adminApi";
import type { AssetRow, SaveAssetBody, ResourceItem } from "@/lib/adminApi";

const FILTER_KEYS = Object.keys(FILTERS) as FilterKey[];
const ICON_KEYS = Object.keys(ICON_MAP);
const NAV_SECTIONS: RouteSection[] = ["insights", "exploration"];
const SLUG_RE = /^[a-z0-9_-]+$/;

// Stable uid counter for list keys — editor-local only, never persisted.
let _uid = 0;
const nextUid = () => `row-${_uid++}`;

interface FilterRow {
  uid: string;
  key: FilterKey;
  widget: string;
}

// Editor-local page type: AssetPage + a stable uid for React keys.
// uid is stripped when building SaveAssetBody (handleSave maps fields explicitly).
type EditorPage = AssetPage & { uid: string };

function blankPage(): EditorPage {
  return { uid: nextUid(), pageId: "", label: "", summaryPrompt: "", suggestions: [] };
}

/**
 * Full structured editor for one dashboard asset. Scalars + editable filter rows
 * (FilterKey→widget id) + ordered pages (id/label/prompt/suggestions). Builds a
 * SaveAssetBody and hands it to onSave; the parent owns the API call + errors.
 * Server-side validate_asset is the source of truth — this does light client
 * guards (slug, required dashboardId, duplicate key on create) and surfaces the
 * rest via the parent's save error.
 */
export default function AssetEditor({
  initial,
  existingKeys,
  onSave,
  onClose,
}: {
  initial: AssetRow | null;
  existingKeys: string[];
  onSave: (body: SaveAssetBody) => Promise<void>;
  onClose: () => void;
}) {
  const creating = initial === null;
  const [assetKey, setAssetKey] = useState(initial?.asset_key ?? "");
  const [label, setLabel] = useState(initial?.spec.label ?? "");
  const [dashboardId, setDashboardId] = useState(initial?.spec.dashboardId ?? "");
  const [globalFilterPage, setGlobalFilterPage] = useState(initial?.spec.globalFilterPage ?? "");
  const [workspace, setWorkspace] = useState(initial?.spec.workspace ?? "");
  const [org, setOrg] = useState(initial?.spec.org ?? "");
  // Nav metadata (PR3c): drives the asset's sidebar entry + route. Optional —
  // when "Show in navigation" is off, no nav is persisted and the asset is
  // embeddable but does not appear in the sidebar on its own.
  const [navEnabled, setNavEnabled] = useState(!!initial?.spec.nav);
  const [navPath, setNavPath] = useState(initial?.spec.nav?.path ?? "");
  const [navIcon, setNavIcon] = useState(initial?.spec.nav?.icon ?? ICON_KEYS[0]);
  const [navSection, setNavSection] = useState<RouteSection>(initial?.spec.nav?.section ?? "insights");
  const [navOrder, setNavOrder] = useState<string>(
    initial?.spec.nav?.order != null ? String(initial.spec.nav.order) : "0"
  );
  const [filterRows, setFilterRows] = useState<FilterRow[]>(
    Object.entries(initial?.spec.filters ?? {}).map(([k, v]) => ({ uid: nextUid(), key: k as FilterKey, widget: v as string }))
  );
  const [pages, setPages] = useState<EditorPage[]>(
    initial?.spec.pages?.length ? initial.spec.pages.map((p) => ({ ...p, uid: nextUid(), suggestions: [...p.suggestions] })) : [blankPage()]
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Workspace dashboards for the id picker (name → id). Fail-soft: on error the
  // list stays empty and the field degrades to plain free-text id entry.
  const [dashboards, setDashboards] = useState<ResourceItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    adminApi
      .listWorkspaceDashboards()
      .then((r) => { if (!cancelled) setDashboards(r.dashboards ?? []); })
      .catch(() => { /* fail-soft — keep free-text entry */ });
    return () => { cancelled = true; };
  }, []);

  const setPage = (i: number, patch: Partial<EditorPage>) =>
    setPages((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  // Fix 2: derive from latest state to avoid stale closure over page.suggestions.
  const setSuggestion = (pi: number, si: number, val: string) =>
    setPages((ps) => ps.map((p, j) => (j === pi ? { ...p, suggestions: p.suggestions.map((s, k) => (k === si ? val : s)) } : p)));

  const removeSuggestion = (pi: number, si: number) =>
    setPages((ps) => ps.map((p, j) => (j === pi ? { ...p, suggestions: p.suggestions.filter((_, k) => k !== si) } : p)));

  const addSuggestion = (pi: number) =>
    setPages((ps) => ps.map((p, j) => (j === pi ? { ...p, suggestions: [...p.suggestions, ""] } : p)));

  async function handleSave() {
    setError(null);
    const key = assetKey.trim();
    if (!key || !SLUG_RE.test(key)) return setError("Asset key must match [a-z0-9_-] and be non-empty.");
    if (creating && existingKeys.includes(key)) return setError(`An asset with key "${key}" already exists.`);
    if (!dashboardId.trim()) return setError("Dashboard id is required.");

    let nav: AssetRow["spec"]["nav"] | undefined;
    if (navEnabled) {
      const path = navPath.trim();
      if (!path.startsWith("/")) return setError("Nav path must start with '/'.");
      const order = Number(navOrder);
      if (!Number.isInteger(order)) return setError("Nav order must be a whole number.");
      nav = { path, icon: navIcon, section: navSection, order };
    }

    const filters: Partial<Record<FilterKey, string>> = {};
    for (const r of filterRows) if (r.widget.trim()) filters[r.key] = r.widget.trim();

    const body: SaveAssetBody = {
      asset_key: key,
      sort_order: initial?.sort_order ?? 0,
      active: initial?.active ?? true,
      spec: {
        label: label.trim() || key,
        dashboardId: dashboardId.trim(),
        globalFilterPage: globalFilterPage.trim(),
        filters,
        ...(workspace.trim() ? { workspace: workspace.trim() } : {}),
        ...(org.trim() ? { org: org.trim() } : {}),
        ...(nav ? { nav } : {}),
        pages: pages.map((p) => ({
          pageId: p.pageId.trim(),
          label: p.label.trim(),
          summaryPrompt: p.summaryPrompt,
          suggestions: p.suggestions.filter((s) => s.trim()),
        })),
      },
    };
    setBusy(true);
    try {
      await onSave(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save asset.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-md border border-brand-border bg-white px-2.5 py-1.5 text-sm";
  const lbl = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

  return (
    <Modal
      title={creating ? "Add asset" : `Edit asset · ${initial?.asset_key}`}
      subtitle="Dashboard spec, filter wiring, and per-page Genie prompts. Changes apply on next load."
      icon={<LayoutDashboard size={18} />}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="rounded-md bg-brand-primary px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-dark disabled:opacity-60"
          >
            {creating ? "Create" : "Save"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        {/* Scalars */}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={lbl}>Asset key</span>
            <input aria-label="Asset key" className={input} value={assetKey} disabled={!creating}
              onChange={(e) => setAssetKey(e.target.value)} placeholder="spend" />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Label</span>
            <input aria-label="Label" className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Spend" />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Dashboard</span>
            {dashboards.length > 0 ? (
              (() => {
                const known = dashboards.some((d) => d.id === dashboardId);
                // Select value: a known id, "" (placeholder) when empty, else the
                // "custom" sentinel (non-empty id not in the workspace list).
                const selectValue = known ? dashboardId : dashboardId ? "__custom__" : "";
                return (
                  <>
                    <select
                      aria-label="Dashboard"
                      className={input}
                      value={selectValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        // Picking "custom" keeps the current id and reveals the
                        // free-text box; picking a real dashboard sets its id.
                        setDashboardId(v === "__custom__" ? (dashboardId || " ") : v === "" ? "" : v);
                      }}
                    >
                      <option value="">Select a dashboard…</option>
                      {dashboards.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                      <option value="__custom__">Other (enter id manually)…</option>
                    </select>
                    {/* Free-text fallback: shown when the id isn't a known workspace
                        dashboard (custom entry / edit of an off-list id). */}
                    {selectValue === "__custom__" && (
                      <input aria-label="Dashboard id" className={input + " mt-1"} value={dashboardId.trim()}
                        placeholder="dashboard id" onChange={(e) => setDashboardId(e.target.value)} />
                    )}
                  </>
                );
              })()
            ) : (
              <input aria-label="Dashboard id" className={input} value={dashboardId}
                placeholder="dashboard id" onChange={(e) => setDashboardId(e.target.value)} />
            )}
          </label>
          <label className="space-y-1">
            <span className={lbl}>Global filter page</span>
            <input aria-label="Global filter page" className={input} value={globalFilterPage} onChange={(e) => setGlobalFilterPage(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Workspace (optional)</span>
            <input aria-label="Workspace" className={input} value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="brand default" />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Org (optional)</span>
            <input aria-label="Org" className={input} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="brand default" />
          </label>
        </div>

        {/* Navigation (PR3c): sidebar entry + route derived from this asset */}
        <div className="space-y-2 rounded-lg border border-brand-border p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" aria-label="Show in navigation" checked={navEnabled}
              onChange={(e) => setNavEnabled(e.target.checked)} />
            <span className={lbl}>Show in navigation</span>
          </label>
          {navEnabled && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="space-y-1">
                <span className={lbl}>Nav path</span>
                <input aria-label="Nav path" className={input} value={navPath} placeholder="/spend-custom"
                  onChange={(e) => setNavPath(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className={lbl}>Icon</span>
                <select aria-label="Nav icon" className={input} value={navIcon}
                  onChange={(e) => setNavIcon(e.target.value)}>
                  {ICON_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={lbl}>Section</span>
                <select aria-label="Nav section" className={input} value={navSection}
                  onChange={(e) => setNavSection(e.target.value as RouteSection)}>
                  {NAV_SECTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={lbl}>Order</span>
                <input aria-label="Nav order" type="number" className={input} value={navOrder}
                  onChange={(e) => setNavOrder(e.target.value)} />
              </label>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={lbl}>Filters</span>
            <button onClick={() => setFilterRows((r) => [...r, { uid: nextUid(), key: FILTER_KEYS[0], widget: "" }])}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-primary-dark">
              <Plus size={13} /> Add filter
            </button>
          </div>
          {filterRows.length === 0 && <p className="text-xs text-slate-400">No filters wired.</p>}
          {filterRows.map((row, i) => (
            <div key={row.uid} className="flex items-center gap-2">
              <select aria-label="Filter key" className={input + " flex-1"} value={row.key}
                onChange={(e) => setFilterRows((r) => r.map((x, j) => (j === i ? { ...x, key: e.target.value as FilterKey } : x)))}>
                {FILTER_KEYS.map((k) => (
                  <option key={k} value={k}>{FILTERS[k].label} ({k})</option>
                ))}
              </select>
              <span className="text-slate-400">→</span>
              <input aria-label="Widget id" className={input + " flex-1"} value={row.widget} placeholder="widget id"
                onChange={(e) => setFilterRows((r) => r.map((x, j) => (j === i ? { ...x, widget: e.target.value } : x)))} />
              <button aria-label="Remove filter" onClick={() => setFilterRows((r) => r.filter((_, j) => j !== i))}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Pages */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={lbl}>Pages</span>
            <button onClick={() => setPages((p) => [...p, blankPage()])}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-primary-dark">
              <Plus size={13} /> Add page
            </button>
          </div>
          {pages.map((page, i) => (
            <div key={page.uid} className="rounded-lg border border-brand-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input aria-label="Page id" className={input + " flex-1"} value={page.pageId} placeholder="pageId"
                  onChange={(e) => setPage(i, { pageId: e.target.value })} />
                <input aria-label="Page label" className={input + " flex-1"} value={page.label} placeholder="Label"
                  onChange={(e) => setPage(i, { label: e.target.value })} />
                <button aria-label="Remove page" disabled={pages.length === 1}
                  onClick={() => setPages((p) => p.filter((_, j) => j !== i))}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 disabled:opacity-40">
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea aria-label="Summary prompt" className={input + " min-h-[60px]"} value={page.summaryPrompt}
                placeholder="Executive summary prompt…" onChange={(e) => setPage(i, { summaryPrompt: e.target.value })} />
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">Suggestions</span>
                {page.suggestions.map((s, si) => (
                  <div key={`${page.uid}:${si}`} className="flex items-center gap-2">
                    <input aria-label="Suggestion" className={input + " flex-1"} value={s}
                      onChange={(e) => setSuggestion(i, si, e.target.value)} />
                    <button aria-label="Remove suggestion" onClick={() => removeSuggestion(i, si)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button onClick={() => addSuggestion(i)}
                  className="inline-flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary-dark">
                  <Plus size={12} /> Add suggestion
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
