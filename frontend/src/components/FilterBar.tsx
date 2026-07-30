import { Fragment, useEffect, useState } from "react";
import { Filter, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DEFAULT_FILTERS, FILTERS } from "@/config";
import type { FilterKey, FilterState } from "@/config";

const DATE_INPUT_CLS =
  "h-8 px-2.5 text-xs rounded-lg border border-border bg-surface text-fg hover:border-border focus:bg-surface focus:outline-none focus:border-border-emphasis focus:ring-2 focus:ring-[rgba(var(--overlay),0.06)] transition-colors";

function StyledSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-8 px-2.5 pr-7 text-xs font-medium rounded-lg border border-border bg-surface text-fg",
          "appearance-none cursor-pointer",
          "focus:bg-surface focus:outline-none focus:ring-2 focus:ring-[rgba(var(--overlay),0.06)] focus:border-border-emphasis",
          "hover:border-border transition-colors",
          className
        )}
        style={{ backgroundImage: "none" }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
    </div>
  );
}

function Divider() {
  return <div className="h-5 w-px bg-border shrink-0" />;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  /** Logical filters to render — comes from the active dashboard's binding. */
  filterKeys: FilterKey[];
}

export default function FilterBar({ filters, onChange, filterKeys }: FilterBarProps) {
  const [draft, setDraft] = useState<FilterState>(filters);

  // Sync the draft when the applied filters change externally (e.g. saved
  // preferences loaded from Lakebase, or a Clear elsewhere).
  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const apply = () => onChange(draft);

  const clear = () => {
    setDraft({ ...DEFAULT_FILTERS });
    onChange({ ...DEFAULT_FILTERS });
  };

  const isDirty =
    draft.currentPeriodFrom !== filters.currentPeriodFrom ||
    draft.currentPeriodTo !== filters.currentPeriodTo ||
    draft.previousPeriodFrom !== filters.previousPeriodFrom ||
    draft.previousPeriodTo !== filters.previousPeriodTo ||
    draft.travelSector !== filters.travelSector ||
    draft.destinationRegion !== filters.destinationRegion;

  const hasNonDefault =
    filters.travelSector ||
    filters.destinationRegion ||
    filters.currentPeriodFrom !== DEFAULT_FILTERS.currentPeriodFrom ||
    filters.currentPeriodTo !== DEFAULT_FILTERS.currentPeriodTo;

  return (
    <div className="shrink-0 bg-surface border-b border-border">
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="grid place-items-center w-6 h-6 rounded-lg bg-[var(--fill-active)] text-accent">
            <Filter size={12} />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted select-none">Filters</span>
        </div>

        {filterKeys.map((key) => {
          const def = FILTERS[key];
          return (
            <Fragment key={key}>
              <Divider />
              {def.kind === "dateRange" ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-fg-muted font-medium">{def.label}</span>
                  <input
                    type="date"
                    value={(draft[def.fromField] as string) || ""}
                    onChange={(e) => setDraft({ ...draft, [def.fromField]: e.target.value })}
                    className={DATE_INPUT_CLS}
                  />
                  <span className="text-xs text-fg-2">→</span>
                  <input
                    type="date"
                    value={(draft[def.toField] as string) || ""}
                    onChange={(e) => setDraft({ ...draft, [def.toField]: e.target.value })}
                    className={DATE_INPUT_CLS}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-fg-muted font-medium">{def.label}</span>
                  <StyledSelect
                    value={(draft[def.field] as string) || ""}
                    onChange={(e) => setDraft({ ...draft, [def.field]: e.target.value || undefined })}
                    style={{ minWidth: "8rem" }}
                  >
                    <option value="">{def.allLabel}</option>
                    {def.options.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </StyledSelect>
                </div>
              )}
            </Fragment>
          );
        })}

        <div className="flex-1" />

        {/* Apply + Clear */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={apply}
            disabled={!isDirty}
            className={cn(
              "h-8 text-xs transition-all",
              isDirty
                ? "bg-linear-to-r from-accent to-accent-alt hover:from-accent-hover hover:to-accent-alt-hover ring-2 ring-[rgba(var(--overlay),0.06)]"
                : "opacity-40 cursor-not-allowed"
            )}
          >
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-fg/90" />}
            Apply
          </Button>
          {hasNonDefault && (
            <button
              onClick={clear}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
