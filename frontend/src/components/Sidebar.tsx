import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ROUTES, ICON_MAP } from "@/config";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PanelLeftClose, PanelLeft } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
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
        onClick={() => navigate(path)}
        title={collapsed ? label : undefined}
        className={cn(
          "w-full flex items-center rounded-md transition-colors",
          collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-2 py-1.5",
          isActive
            ? "bg-apex-primary text-white font-medium shadow-sm"
            : "text-white/60 hover:bg-apex-sidebar-hover hover:text-white"
        )}
      >
        {Icon && <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />}
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-sm">{label}</span>
            {placeholder && (
              <span className="text-[9px] font-semibold tracking-wider uppercase bg-white/10 text-white/50 px-1.5 py-0.5 rounded">
                soon
              </span>
            )}
          </>
        )}
      </button>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 h-full bg-apex-sidebar transition-all duration-200",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Logo + collapse toggle */}
      <div className="px-3 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <div>
              <div className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5 px-1">
                ✦ APEX
              </div>
              <div className="text-[9px] text-white/40 tracking-[0.2em] uppercase mt-0.5 px-1">
                Advito Practice Exchange
              </div>
            </div>
          ) : (
            <div className="text-white font-bold text-lg mx-auto">✦</div>
          )}
          <button
            onClick={onToggle}
            className="p-1 text-white/40 hover:text-white/80 transition-colors rounded"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>

      {/* Client badge */}
      {!collapsed ? (
        <div className="px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-xs font-medium text-white/70 truncate">CloudVenture</span>
          </div>
        </div>
      ) : (
        <div className="py-2 border-b border-white/10 shrink-0 flex justify-center">
          <span className="w-2 h-2 rounded-full bg-emerald-400" title="CloudVenture" />
        </div>
      )}

      {/* Nav sections */}
      <ScrollArea className={cn("flex-1 py-4", collapsed ? "px-1.5" : "px-3")}>
        {/* Insights & Analytics */}
        <div className="mb-4">
          {!collapsed && (
            <div className="text-[9px] text-white/30 font-semibold tracking-[0.2em] uppercase px-2 mb-2">
              Insights & Analytics
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {insightsRoutes.map((route) => (
              <NavItem
                key={route.path}
                path={route.path}
                label={route.label}
                icon={route.icon}
                placeholder={route.mode === "placeholder"}
              />
            ))}
          </div>
        </div>

        {/* Exploration */}
        <div>
          {!collapsed && (
            <div className="text-[9px] text-white/30 font-semibold tracking-[0.2em] uppercase px-2 mb-2">
              Exploration
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {explorationRoutes.map((route) => (
              <NavItem
                key={route.path}
                path={route.path}
                label={route.label}
                icon={route.icon}
                placeholder={route.mode === "placeholder"}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
