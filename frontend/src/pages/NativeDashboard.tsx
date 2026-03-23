import { useState } from "react";
import { Loader2 } from "lucide-react";

interface NativeDashboardProps {
  embedUrl: string;
}

export default function NativeDashboard({ embedUrl }: NativeDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
          <Loader2 size={32} className="text-indigo-500 animate-spin" />
        </div>
      )}
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        title="APEX Dashboard"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
