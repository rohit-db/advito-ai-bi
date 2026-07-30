import { cn } from "@/lib/utils";
import { PanelLeftClose } from "lucide-react";
import { brand } from "@/theme/brand";
import { BrandLogo } from "@/components/BrandLogo";

export default function BrandBlock({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center h-full shrink-0 border-r border-border transition-all duration-200",
        collapsed ? "w-[60px] justify-center" : "w-[224px] gap-2.5 px-3"
      )}
    >
      {collapsed ? (
        <button
          onClick={onToggle}
          title="Expand sidebar"
          className="p-1 rounded-lg hover:bg-[var(--fill-hover)] transition-colors"
        >
          <BrandLogo variant="mark" className="w-8 h-8 text-base" />
        </button>
      ) : (
        <>
          <BrandLogo variant="mark" className="w-8 h-8 text-base shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold tracking-tight text-fg leading-none">
              {brand.identity.appName}
            </div>
            <div className="text-[8.5px] text-fg-muted tracking-[0.16em] uppercase mt-1 truncate">
              {brand.identity.tagline}
            </div>
          </div>
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            className="p-1.5 text-fg-muted hover:text-fg hover:bg-[var(--fill-hover)] transition-colors rounded-lg shrink-0"
          >
            <PanelLeftClose size={16} />
          </button>
        </>
      )}
    </div>
  );
}
