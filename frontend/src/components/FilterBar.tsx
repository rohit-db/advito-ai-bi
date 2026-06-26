import { useState, useEffect } from "react";
import { Filter, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FilterState } from "@/config";
import { DEFAULT_FILTERS } from "@/config";

const TRAVEL_SECTORS = ["", "Domestic", "Regional", "Intra Country", "Intra Continental", "Inter Continental", "Intercontinental"] as const;
const REGIONS = [
  "", "Africa", "Asia", "Europe", "Latin America",
  "Middle East", "North America", "Southwestern Pacific", "Unknown",
] as const;

function StyledSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-8 px-2.5 pr-7 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50/80 text-slate-700",
          "appearance-none cursor-pointer",
          "focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400",
          "hover:border-slate-300 transition-colors",
          className
        )}
        style={{ backgroundImage: "none" }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

function Divider() {
  return <div className="h-5 w-px bg-slate-200 shrink-0" />;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
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
    <div className="shrink-0 bg-white border-b border-slate-100">
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="grid place-items-center w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600">
            <Filter size={12} />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 select-none">Filters</span>
        </div>

        <Divider />

        {/* Current Period */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 font-medium">Period</span>
          <input
            type="date"
            value={draft.currentPeriodFrom}
            onChange={(e) => setDraft({ ...draft, currentPeriodFrom: e.target.value })}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 focus:bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors"
          />
          <span className="text-xs text-slate-300">→</span>
          <input
            type="date"
            value={draft.currentPeriodTo}
            onChange={(e) => setDraft({ ...draft, currentPeriodTo: e.target.value })}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 focus:bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors"
          />
        </div>

        <Divider />

        {/* Previous Period */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 font-medium">vs</span>
          <input
            type="date"
            value={draft.previousPeriodFrom}
            onChange={(e) => setDraft({ ...draft, previousPeriodFrom: e.target.value })}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 focus:bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors"
          />
          <span className="text-xs text-slate-300">→</span>
          <input
            type="date"
            value={draft.previousPeriodTo}
            onChange={(e) => setDraft({ ...draft, previousPeriodTo: e.target.value })}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 focus:bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors"
          />
        </div>

        <Divider />

        {/* Travel Sector */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-500 font-medium">Sector</span>
          <StyledSelect
            value={draft.travelSector || ""}
            onChange={(e) => setDraft({ ...draft, travelSector: e.target.value || undefined })}
            style={{ minWidth: "8rem" }}
          >
            <option value="">All Sectors</option>
            {TRAVEL_SECTORS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </StyledSelect>
        </div>

        <Divider />

        {/* Destination Region */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-500 font-medium">Region</span>
          <StyledSelect
            value={draft.destinationRegion || ""}
            onChange={(e) => setDraft({ ...draft, destinationRegion: e.target.value || undefined })}
            style={{ minWidth: "8rem" }}
          >
            <option value="">All Regions</option>
            {REGIONS.filter(Boolean).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </StyledSelect>
        </div>

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
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 ring-2 ring-indigo-100"
                : "opacity-40 cursor-not-allowed"
            )}
          >
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-white/90" />}
            Apply
          </Button>
          {hasNonDefault && (
            <button
              onClick={clear}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
