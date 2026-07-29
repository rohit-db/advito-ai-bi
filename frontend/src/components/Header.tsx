import { useLocation } from "react-router-dom";
import { ChevronRight, LogOut } from "lucide-react";
import { useRoutes } from "@/registry/useRegistry";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ThemeToggle from "@/theme/ThemeToggle";

const SECTION_LABELS: Record<string, string> = {
  insights: "Insights & Analytics",
  exploration: "Exploration",
};

export default function Header() {
  const location = useLocation();
  const { user } = useUser();
  const routes = useRoutes();

  const currentRoute = routes.find((r) => r.path === location.pathname);
  const pageTitle = currentRoute?.label ?? "APEX";
  const sectionLabel = currentRoute ? SECTION_LABELS[currentRoute.section] : undefined;

  const initials =
    user?.initials ??
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ??
    "?";

  const displayName = user?.displayName ?? "User";
  const email = user?.email;

  return (
    <header className="relative z-40 h-14 bg-white/90 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between px-5 shrink-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">
        {sectionLabel && (
          <>
            <span className="text-[13px] text-slate-400 truncate hidden sm:inline">{sectionLabel}</span>
            <ChevronRight size={14} className="text-slate-300 shrink-0 hidden sm:inline" />
          </>
        )}
        <span className="text-[15px] font-semibold text-slate-900 tracking-tight truncate">
          {pageTitle}
        </span>
      </nav>

      {/* Right cluster: theme toggle + user menu */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Popover>
        <PopoverTrigger className="group gap-2.5 rounded-full pl-1 pr-2.5 py-1 hover:bg-slate-100 transition-colors">
          <Avatar size="sm" className="ring-2 ring-white shadow-sm">
            <AvatarFallback className="bg-linear-to-br from-brand-primary to-brand-accent text-white text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-[13px] font-medium text-slate-700 max-w-[140px] truncate hidden sm:inline">
            {displayName}
          </span>
          <ChevronRight size={14} className="text-slate-400 rotate-90 hidden sm:inline" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 border-b border-slate-100">
            <Avatar size="sm" className="ring-2 ring-white shadow-sm">
              <AvatarFallback className="bg-linear-to-br from-brand-primary to-brand-accent text-white text-[11px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{displayName}</div>
              {email && <div className="text-xs text-slate-500 truncate">{email}</div>}
            </div>
          </div>
          <a
            href="/logout"
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LogOut size={15} className="text-slate-400" />
            Sign out
          </a>
        </PopoverContent>
      </Popover>
      </div>
    </header>
  );
}
