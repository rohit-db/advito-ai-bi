import * as React from "react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  topBar: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ topBar, sidebar, children, className }: AppShellProps) {
  return (
    <div className={cn("flex h-dvh flex-col overflow-hidden bg-secondary", className)}>
      {topBar}
      <div className="flex flex-1 overflow-hidden">
        {sidebar}
        <div className="flex flex-1 flex-col min-w-0">{children}</div>
      </div>
    </div>
  );
}
