import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ROUTES, ICON_MAP } from "@/config";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const insightsRoutes = ROUTES.filter((r) => r.section === "insights");
  const explorationRoutes = ROUTES.filter((r) => r.section === "exploration");

  function NavItem({ path, label, icon, placeholder }: {
    path: string;
    label: string;
    icon: string;
    placeholder?: boolean;
  }) {
    const Icon = ICON_MAP[icon];
    const isActive = location.pathname === path;

    return (
      <button
        key={path}
        onClick={() => navigate(path)}
        className={cn(
          "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
          isActive
            ? "bg-apex-primary text-white font-medium shadow-sm"
            : "text-white/60 hover:bg-sidebar-hover hover:text-white"
        )}
      >
        {Icon && <Icon size={16} />}
        <span className="flex-1 text-left">{label}</span>
        {placeholder && (
          <span className="text-[9px] font-semibold tracking-wider uppercase bg-white/10 text-white/50 px-1.5 py-0.5 rounded">
            soon
          </span>
        )}
      </button>
    );
  }

  return (
    <aside
      className="flex flex-col shrink-0 h-full"
      style={{ width: "220px", backgroundColor: "#1e1b4b" }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 shrink-0">
        <div className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
          ✦ APEX
        </div>
        <div className="text-[10px] text-white/50 tracking-widest uppercase mt-0.5">
          Advito Practice Exchange
        </div>
      </div>

      {/* Client badge */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-white/80 truncate">CloudVenture</span>
        </div>
      </div>

      {/* Nav sections */}
      <ScrollArea className="flex-1 px-3 py-4">
        {/* Insights & Analytics */}
        <div className="mb-4">
          <div className="text-[10px] text-white/40 font-semibold tracking-widest uppercase px-2 mb-2">
            Insights &amp; Analytics
          </div>
          <div className="flex flex-col gap-0.5">
            {insightsRoutes.map((route) => (
              <NavItem
                key={route.path}
                path={route.path}
                label={route.label}
                icon={route.icon}
                placeholder={route.placeholder}
              />
            ))}
          </div>
        </div>

        {/* Exploration */}
        <div>
          <div className="text-[10px] text-white/40 font-semibold tracking-widest uppercase px-2 mb-2">
            Exploration
          </div>
          <div className="flex flex-col gap-0.5">
            {explorationRoutes.map((route) => (
              <NavItem
                key={route.path}
                path={route.path}
                label={route.label}
                icon={route.icon}
                placeholder={route.placeholder}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
