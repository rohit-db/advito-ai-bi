import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "@/config";
import { useRoutes } from "@/registry/useRegistry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Settings } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { ADMIN_BASE, ADMIN_SECTIONS, ADMIN_ASSETS_PATH } from "@/components/admin/adminContext";

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const isOperator = user?.role === "operator";

  const inAdmin = location.pathname.startsWith(ADMIN_BASE);

  const routes = useRoutes();
  const insightsRoutes = routes.filter((r) => r.section === "insights");
  const explorationRoutes = routes.filter((r) => r.section === "exploration");

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
          "group relative w-full flex items-center rounded-md transition-all duration-150",
          collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-2.5 py-2",
          isActive
            ? "bg-white/10 text-white"
            : "text-white/55 hover:bg-white/5 hover:text-white"
        )}
      >
        {isActive && !collapsed && (
          <span className="absolute left-0 inset-y-1.5 w-[3px] rounded-r-full bg-accent" />
        )}
        {Icon && (
          <Icon
            size={17}
            strokeWidth={isActive ? 2.2 : 1.75}
            className={cn("shrink-0 transition-colors", isActive ? "text-accent" : "text-white/55 group-hover:text-white")}
          />
        )}
        {!collapsed && (
          <>
            <span className={cn("flex-1 text-left text-[13px]", isActive ? "font-semibold" : "font-medium")}>
              {label}
            </span>
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
        "flex flex-col shrink-0 h-full bg-linear-to-b from-brand-sidebar-from via-brand-sidebar-via to-brand-sidebar-to transition-all duration-200",
        collapsed ? "w-[60px]" : "w-[224px]"
      )}
    >
      {/* Nav sections */}
      <ScrollArea className={cn("flex-1 py-4", collapsed ? "px-1.5" : "px-3")}>
        {inAdmin && isOperator ? (
          /* ── Admin context: Back link + admin sections ── */
          <div>
            {/* Back to APEX */}
            <button
              onClick={() => navigate("/")}
              title={collapsed ? "Back to APEX" : undefined}
              className={cn(
                "group w-full flex items-center rounded-md transition-all duration-150 mb-3",
                collapsed ? "justify-center px-2 py-2" : "gap-2 px-2.5 py-2",
                "text-white/55 hover:bg-white/5 hover:text-white"
              )}
            >
              <ArrowLeft
                size={16}
                strokeWidth={1.75}
                className="shrink-0 text-white/55 group-hover:text-white transition-colors"
              />
              {!collapsed && (
                <span className="text-[13px] font-medium">Back to APEX</span>
              )}
            </button>

            {/* Administration section heading */}
            {!collapsed && (
              <div className="text-[9px] text-white/30 font-semibold tracking-[0.2em] uppercase px-2 mb-2">
                Administration
              </div>
            )}

            {/* Admin nav items */}
            <div className="flex flex-col gap-0.5">
              {ADMIN_SECTIONS.map((section) => (
                <NavItem
                  key={section.path}
                  path={section.path}
                  label={section.label}
                  icon={section.icon}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ── Analytics context: Insights + Exploration ── */
          <>
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
          </>
        )}
      </ScrollArea>

      {/* Admin footer (operator-only, analytics view only) */}
      {isOperator && !inAdmin && (
        <div className="px-3 py-3 border-t border-white/10 shrink-0">
          <button
            onClick={() => navigate(ADMIN_ASSETS_PATH)}
            title={collapsed ? "Admin" : undefined}
            className={cn(
              "group w-full flex items-center rounded-md transition-all duration-150",
              collapsed ? "justify-center px-2 py-2" : "gap-2 px-2.5 py-2",
              "text-white/55 hover:bg-white/5 hover:text-white"
            )}
          >
            <Settings
              size={16}
              strokeWidth={1.75}
              className="shrink-0 text-white/55 group-hover:text-white transition-colors"
            />
            {!collapsed && <span className="text-[13px] font-medium">Admin</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
