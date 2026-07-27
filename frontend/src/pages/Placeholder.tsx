import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";
import { ROUTES } from "@/config";

export default function Placeholder() {
  const location = useLocation();
  const currentRoute = ROUTES.find((r) => r.path === location.pathname);
  const label = currentRoute?.label ?? "This Module";

  return (
    <div className="flex flex-1 items-center justify-center h-full bg-slate-50">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="w-14 h-14 rounded-xl bg-brand-primary-light flex items-center justify-center">
          <Construction size={28} className="text-brand-accent" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-1">{label}</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            This module is under development and will be available in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
