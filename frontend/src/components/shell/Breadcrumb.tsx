import { ChevronRight } from "lucide-react";

export default function Breadcrumb({ section, page }: { section?: string; page: string }) {
  return (
    <nav className="flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">
      {section && (
        <>
          <span className="text-[13px] text-fg-muted truncate hidden sm:inline">{section}</span>
          <ChevronRight size={14} className="text-fg-subtle shrink-0 hidden sm:inline" />
        </>
      )}
      <span className="text-[13px] font-medium text-fg tracking-tight truncate">{page}</span>
    </nav>
  );
}
