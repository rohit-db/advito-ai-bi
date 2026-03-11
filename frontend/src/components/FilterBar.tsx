import { Filter, X } from "lucide-react";

export interface Filters {
  dateFrom?: string;
  dateTo?: string;
  pickupZip?: string;
  paymentType?: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const PAYMENT_TYPES = ["", "Cash", "Credit Card", "No Charge", "Dispute"];

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const hasFilters = Object.values(filters).some((v) => v);

  const update = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const clear = () => onChange({});

  return (
    <div className="shrink-0 bg-white border-b border-apex-border px-4 py-2 flex items-center gap-4">
      <div className="flex items-center gap-1.5 text-gray-400">
        <Filter size={14} />
        <span className="text-xs font-semibold uppercase tracking-wider">
          Filters
        </span>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">From</label>
        <input
          type="date"
          value={filters.dateFrom || ""}
          onChange={(e) => update("dateFrom", e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-apex-purple/30"
        />
        <label className="text-xs text-gray-500">To</label>
        <input
          type="date"
          value={filters.dateTo || ""}
          onChange={(e) => update("dateTo", e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-apex-purple/30"
        />
      </div>

      {/* Pickup Zip */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">Pickup Zip</label>
        <input
          type="text"
          placeholder="All"
          value={filters.pickupZip || ""}
          onChange={(e) => update("pickupZip", e.target.value)}
          className="w-20 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-apex-purple/30"
        />
      </div>

      {/* Payment Type */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">Payment</label>
        <select
          value={filters.paymentType || ""}
          onChange={(e) => update("paymentType", e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-apex-purple/30"
        >
          <option value="">All</option>
          {PAYMENT_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={clear}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 ml-auto"
        >
          <X size={12} /> Clear
        </button>
      )}

      {hasFilters && (
        <div className="text-[10px] text-indigo-500 ml-auto">
          Genie will use these filters as context
        </div>
      )}
    </div>
  );
}
