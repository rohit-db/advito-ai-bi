import { useLocation } from "react-router-dom";
import { useRoutes } from "@/registry/useRegistry";
import { useUser } from "@/hooks/useUser";
import ThemeToggle from "@/theme/ThemeToggle";
import BrandBlock from "./BrandBlock";
import Breadcrumb from "./Breadcrumb";
import ClientBadge from "./ClientBadge";
import UserMenu from "./UserMenu";

const SECTION_LABELS: Record<string, string> = {
  insights: "Insights & Analytics",
  exploration: "Exploration",
};

export default function TopBar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();
  const { user } = useUser();
  const routes = useRoutes();

  const currentRoute = routes.find((r) => r.path === location.pathname);
  const pageTitle = currentRoute?.label ?? "APEX";
  const sectionLabel = currentRoute ? SECTION_LABELS[currentRoute.section] : undefined;
  const clientName = user?.tenant || "All clients";

  return (
    <header className="relative z-40 h-12 flex shrink-0 border-b border-border">
      <BrandBlock collapsed={collapsed} onToggle={onToggle} />
      <div className="flex-1 flex items-center justify-between gap-3 px-4 bg-surface-2 min-w-0">
        <Breadcrumb section={sectionLabel} page={pageTitle} />
        <div className="flex items-center gap-2 shrink-0">
          <ClientBadge tenant={clientName} />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
