import type { GenieTable } from "@/hooks/useGenieMcpChat";

// Shared result table for every Genie surface. `size="md"` matches the full
// page density; `size="sm"` matches the dashboard rail / executive summary.
export default function GenieResultTable({
  table,
  size = "md",
}: {
  table: GenieTable;
  size?: "sm" | "md";
}) {
  const columns = (table.columns || []).map((c) => (typeof c === "string" ? c : c.name));
  const rows = table.rows || [];
  if (columns.length === 0 || rows.length === 0) return null;

  const sm = size === "sm";
  const text = sm ? "text-[11px]" : "text-xs";
  const cell = sm ? "px-2.5 py-1.5" : "px-3 py-2";
  const wrapper = sm
    ? "mt-3 overflow-auto max-h-60 border border-gray-200 rounded-lg"
    : "mt-3 overflow-x-auto border border-gray-200 rounded-lg";

  return (
    <div className={wrapper}>
      <table className={`min-w-full divide-y divide-gray-200 ${text}`}>
        <thead className={`bg-gray-100 ${sm ? "sticky top-0" : ""}`}>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={`${cell} text-left font-semibold text-gray-700 whitespace-nowrap`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((value, c) => (
                <td key={c} className={`${cell} text-gray-600 whitespace-nowrap border-t border-gray-100`}>
                  {value == null ? "" : String(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
