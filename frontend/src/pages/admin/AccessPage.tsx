import { ShieldCheck } from "lucide-react";
import AccessGrid from "@/components/admin/AccessGrid";
import { useAdminOutlet } from "@/components/admin/adminContext";

export default function AccessPage() {
  const { reportAccessError } = useAdminOutlet();
  return (
    <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-brand-primary to-brand-accent text-white shadow-sm">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Tenant access</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
            Grant or revoke each tenant Service Principal's access to dashboards and Genie spaces.
          </p>
        </div>
      </div>
      <AccessGrid onAccessError={reportAccessError} />
    </div>
  );
}
