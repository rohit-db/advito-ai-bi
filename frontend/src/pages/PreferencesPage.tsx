import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Check, RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FILTERS,
  DEFAULT_FILTERS,
  DEFAULT_PREFS_KEY,
  fetchFilterPrefs,
  saveFilterPrefs,
} from "@/config";
import type { FilterKey, FilterState } from "@/config";

/**
 * User-facing "default filters" page. Whatever the user saves here becomes the
 * starting filter selection on every dashboard they open (unless they've saved a
 * dashboard-specific selection via the filter bar, which takes precedence).
 * Persisted per-user in Lakebase under the DEFAULT_PREFS_KEY sentinel.
 */
const ALL_KEYS = Object.keys(FILTERS) as FilterKey[];

const INPUT_CLS =
  "h-9 px-3 text-sm rounded border border-input bg-background text-foreground " +
  "hover:border-neutral-200 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring transition-colors placeholder:text-muted-foreground";

export default function PreferencesPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [initial, setInitial] = useState<FilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFilterPrefs(DEFAULT_PREFS_KEY).then((saved) => {
      if (cancelled) return;
      const merged = { ...DEFAULT_FILTERS, ...(saved || {}) };
      setFilters(merged);
      setInitial(merged);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(initial),
    [filters, initial]
  );

  const set = (patch: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setSavedAt(false);
  };

  const save = async () => {
    setSaving(true);
    await saveFilterPrefs(DEFAULT_PREFS_KEY, filters);
    setInitial(filters);
    setSaving(false);
    setSavedAt(true);
    window.dispatchEvent(new CustomEvent("prism:filter-prefs-saved"));
    window.setTimeout(() => setSavedAt(false), 2500);
  };

  const reset = () => set({ ...DEFAULT_FILTERS });

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">My Filters</h1>
            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
              Set the filters you want applied by default across your dashboards. You can still
              change filters on any individual dashboard.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-secondary shadow-sm">
          <div className="border-b border-border px-6 py-3.5">
            <h2 className="text-sm font-semibold text-foreground">Default selection</h2>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="divide-y divide-border">
              {ALL_KEYS.map((key) => {
                const def = FILTERS[key];
                return (
                  <div
                    key={key}
                    className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {def.kind === "dateRange" && def.label === "vs"
                          ? "Comparison period"
                          : def.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {def.kind === "dateRange" ? "Date range" : "Single value"}
                      </div>
                    </div>

                    {def.kind === "dateRange" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={(filters[def.fromField] as string) || ""}
                          onChange={(e) => set({ [def.fromField]: e.target.value } as Partial<FilterState>)}
                          className={INPUT_CLS}
                        />
                        <span className="text-muted-foreground">→</span>
                        <input
                          type="date"
                          value={(filters[def.toField] as string) || ""}
                          onChange={(e) => set({ [def.toField]: e.target.value } as Partial<FilterState>)}
                          className={INPUT_CLS}
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={(filters[def.field] as string) || ""}
                          onChange={(e) =>
                            set({ [def.field]: e.target.value || undefined } as Partial<FilterState>)
                          }
                          className={cn(INPUT_CLS, "min-w-[13rem] appearance-none cursor-pointer pr-9")}
                          style={{ backgroundImage: "none" }}
                        >
                          <option value="">{def.allLabel}</option>
                          {def.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-6 py-3.5">
            <button
              onClick={reset}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw size={13} />
              Reset to defaults
            </button>
            <div className="flex items-center gap-3">
              {savedAt && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-[var(--success)] bg-[var(--background-success)]">
                  <Check size={14} /> Saved
                </span>
              )}
              <Button size="sm" onClick={save} disabled={!dirty || saving || loading} className="gap-1.5 bg-primary text-primary-foreground hover:bg-blue-700">
                {saving ? "Saving…" : "Save defaults"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
