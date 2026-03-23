import { useState } from "react";
import { Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FilterState } from "@/config";
import { DEFAULT_FILTERS } from "@/config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ["USD", "EUR", "GBP"] as const;
const CATEGORIES = ["All", "Air", "Hotel", "Rail", "Car", "Taxi/Rideshare"] as const;
const METHODOLOGIES = ["ADVITO", "DEFRA", "ADVITO_wo_RF"] as const;
const DATE_TYPES = ["Invoice Date", "Travel Start Date"] as const;

// ---------------------------------------------------------------------------
// Shared styled-select helper (native <select> with polished appearance)
// ---------------------------------------------------------------------------

interface StyledSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

function StyledSelect({ className, children, ...props }: StyledSelectProps) {
  return (
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
  );
}

// ---------------------------------------------------------------------------
// Month input
// ---------------------------------------------------------------------------

interface MonthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

function MonthInput({ label, className, ...props }: MonthInputProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <input
        type="month"
        className={cn(
          "h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-700",
          "focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400",
          "hover:border-gray-300 transition-colors",
          className
        )}
        {...props}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

function Divider() {
  return <div className="h-5 w-px bg-gray-200 shrink-0" />;
}

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------

// APEX-specific filter keys stored in FilterState's index signature
type ApexFilterKey =
  | "periodFrom"
  | "periodTo"
  | "currency"
  | "category"
  | "methodology"
  | "dateType";

const APEX_DEFAULTS: Record<ApexFilterKey, string> = {
  periodFrom: "",
  periodTo: "",
  currency: "USD",
  category: "All",
  methodology: "ADVITO",
  dateType: "Invoice Date",
};

function getApex(filters: FilterState, key: ApexFilterKey): string {
  const val = filters[key];
  return typeof val === "string" ? val : APEX_DEFAULTS[key];
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  // Draft — changes accumulate locally; Apply commits them upstream
  const [draft, setDraft] = useState<FilterState>(filters);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = (key: ApexFilterKey, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const apply = () => onChange(draft);

  const clear = () => {
    const reset: FilterState = {
      ...DEFAULT_FILTERS,
      ...APEX_DEFAULTS,
    };
    setDraft(reset);
    onChange(reset);
  };

  const isDirty = (Object.keys(APEX_DEFAULTS) as ApexFilterKey[]).some(
    (key) => getApex(draft, key) !== getApex(filters, key)
  );

  const hasActiveFilters = (Object.keys(APEX_DEFAULTS) as ApexFilterKey[]).some(
    (key) => getApex(filters, key) !== APEX_DEFAULTS[key]
  );

  return (
    <div className="shrink-0 bg-white border-b border-gray-100">
      {/* Primary row */}
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
        {/* Filter icon + label */}
        <div className="flex items-center gap-1.5 text-gray-400 shrink-0">
          <Filter size={13} />
          <span className="text-[10px] font-semibold uppercase tracking-widest select-none">
            Filters
          </span>
        </div>

        <Divider />

        {/* Period */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 font-medium shrink-0">Period</span>
          <MonthInput
            label="From"
            value={getApex(draft, "periodFrom")}
            onChange={(e) => update("periodFrom", e.target.value)}
          />
          <MonthInput
            label="To"
            value={getApex(draft, "periodTo")}
            onChange={(e) => update("periodTo", e.target.value)}
          />
        </div>

        <Divider />

        {/* Currency */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-500 font-medium">Currency</span>
          <div className="relative">
            <StyledSelect
              value={getApex(draft, "currency")}
              onChange={(e) => update("currency", e.target.value)}
              style={{ paddingRight: "1.5rem" }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </StyledSelect>
            <ChevronDown
              size={10}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        <Divider />

        {/* Category */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-500 font-medium">Category</span>
          <div className="relative">
            <StyledSelect
              value={getApex(draft, "category")}
              onChange={(e) => update("category", e.target.value)}
              style={{ paddingRight: "1.5rem", minWidth: "8rem" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </StyledSelect>
            <ChevronDown
              size={10}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        <Divider />

        {/* Advanced toggle */}
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          className={cn(
            "flex items-center gap-1 text-xs font-medium rounded-md px-2 h-7 transition-colors shrink-0",
            advancedOpen
              ? "bg-indigo-50 text-indigo-600"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          )}
        >
          {advancedOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Advanced
        </button>

        {/* Spacer */}
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
          {hasActiveFilters && (
            <button
              onClick={clear}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={11} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Advanced row (collapsible) */}
      {advancedOpen && (
        <div className="px-4 pb-2 flex items-center gap-3 border-t border-gray-50 pt-2">
          <div className="w-[13px]" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 select-none">
            Advanced
          </span>

          <Divider />

          {/* Methodology */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-500 font-medium">Methodology</span>
            <div className="relative">
              <StyledSelect
                value={getApex(draft, "methodology")}
                onChange={(e) => update("methodology", e.target.value)}
                style={{ paddingRight: "1.5rem", minWidth: "9rem" }}
              >
                {METHODOLOGIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </StyledSelect>
              <ChevronDown
                size={10}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          <Divider />

          {/* Date Type */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-500 font-medium">Date Type</span>
            <div className="relative">
              <StyledSelect
                value={getApex(draft, "dateType")}
                onChange={(e) => update("dateType", e.target.value)}
                style={{ paddingRight: "1.5rem", minWidth: "9.5rem" }}
              >
                {DATE_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </StyledSelect>
              <ChevronDown
                size={10}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
