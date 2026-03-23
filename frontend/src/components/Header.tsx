import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/config";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface HeaderProps {
  chatOpen: boolean;
  onToggleChat: () => void;
}

export default function Header({ chatOpen, onToggleChat }: HeaderProps) {
  const location = useLocation();
  const { user } = useUser();

  const currentRoute = ROUTES.find((r) => r.path === location.pathname);
  const pageTitle = currentRoute?.label ?? "APEX";

  const isOnApexQA = location.pathname === "/apex-qa";

  const initials = user?.initials ?? user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  const displayName = user?.displayName ?? "User";

  return (
    <header className="h-12 bg-white border-b border-apex-border flex items-center justify-between px-4 shrink-0">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-slate-800 tracking-tight">{pageTitle}</h1>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {!isOnApexQA && (
          <Button
            variant={chatOpen ? "default" : "outline"}
            size="sm"
            onClick={onToggleChat}
            className={cn(
              "gap-1.5",
              chatOpen && "bg-indigo-600 hover:bg-indigo-700 text-white"
            )}
          >
            <MessageCircle size={14} />
            Ask APEX
          </Button>
        )}

        {/* User avatar + name */}
        <div className="flex items-center gap-2">
          <Avatar size="sm" className="bg-indigo-100">
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-slate-600 max-w-[120px] truncate">{displayName}</span>
        </div>
      </div>
    </header>
  );
}
