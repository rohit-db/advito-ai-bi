import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";
import { useRoutes } from "@/registry/useRegistry";

export default function Placeholder() {
  const location = useLocation();
  const routes = useRoutes();
  const currentRoute = routes.find((r) => r.path === location.pathname);
  const label = currentRoute?.label ?? "This Module";

  return (
    <div className="flex flex-1 items-center justify-center h-full bg-surface">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center p-8 bg-surface-2 rounded-xl border border-border shadow-sm">
        <div className="w-14 h-14 rounded-xl bg-surface-3 flex items-center justify-center">
          <Construction size={28} className="text-fg-muted" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-fg mb-1">{label}</h2>
          <p className="text-sm text-fg-muted leading-relaxed">
            This module is under development and will be available in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
