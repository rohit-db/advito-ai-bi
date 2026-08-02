import { ChevronRight, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface UserLike {
  displayName?: string;
  email?: string;
  initials?: string;
}

export default function UserMenu({ user }: { user: UserLike | null }) {
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
    <Popover>
      <PopoverTrigger asChild>
        <button className="group flex items-center gap-2.5 rounded-full pl-1 pr-2.5 py-1 hover:bg-[var(--action-default-bg-hover)] transition-colors">
          <Avatar size="sm" className="ring-2 ring-[var(--secondary)] shadow-db-xs">
            <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-[13px] font-medium text-muted-foreground max-w-[140px] truncate hidden sm:inline">
            {displayName}
          </span>
          <ChevronRight size={14} className="text-muted-foreground rotate-90 hidden sm:inline" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 bg-secondary border-b border-border">
          <Avatar size="sm" className="ring-2 ring-[var(--secondary)] shadow-db-xs">
            <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
            {email && <div className="text-xs text-muted-foreground truncate">{email}</div>}
          </div>
        </div>
        <a
          href="/logout"
          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-[var(--action-default-bg-hover)] transition-colors"
        >
          <LogOut size={15} className="text-muted-foreground" />
          Sign out
        </a>
      </PopoverContent>
    </Popover>
  );
}
