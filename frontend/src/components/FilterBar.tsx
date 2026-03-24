import { useState } from "react";
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
          "h-7 px-2 pr-6 text-xs rounded-md border border-gray-200 bg-white text-gray-700",
          "appearance-none cursor-pointer",
          "focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400",
          "hover:border-gray-300 transition-colors",
          className
        )}
        style={{ backgroundImage: "none" }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function Divider() {
  return <div className="h-5 w-px bg-gray-200 shrink-0" />;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [draft, setDraft] = useState<FilterState>(filters);

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
    <div className="shrink-0 bg-white border-b border-gray-100">
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-gray-400 shrink-0">
          <Filter size={13} />
          <span className="text-[10px] font-semibold uppercase tracking-widest select-none">Filters</span>
        </div>

        <Divider />

        {/* Current Period */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 font-medium">Period</span>
          <input
            type="date"
            value={draft.currentPeriodFrom}
            onChange={(e) => setDraft({ ...draft, currentPeriodFrom: e.target.value })}
            className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <span className="text-xs text-gray-300">→</span>
          <input
            type="date"
            value={draft.currentPeriodTo}
            onChange={(e) => setDraft({ ...draft, currentPeriodTo: e.target.value })}
            className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <Divider />

        {/* Previous Period */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 font-medium">vs</span>
          <input
            type="date"
            value={draft.previousPeriodFrom}
            onChange={(e) => setDraft({ ...draft, previousPeriodFrom: e.target.value })}
            className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <span className="text-xs text-gray-300">→</span>
          <input
            type="date"
            value={draft.previousPeriodTo}
            onChange={(e) => setDraft({ ...draft, previousPeriodTo: e.target.value })}
            className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <Divider />

        {/* Travel Sector */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-500 font-medium">Sector</span>
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
          <span className="text-xs text-gray-500 font-medium">Region</span>
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
            className={cn("h-7 text-xs", !isDirty && "opacity-40 cursor-not-allowed")}
          >
            Apply
          </Button>
          {hasNonDefault && (
            <button
              onClick={clear}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
