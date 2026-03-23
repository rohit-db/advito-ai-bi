import React from "react";
import { cn } from "../../lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ScrollArea({ className, children, ...props }: ScrollAreaProps) {
  return (
    <div
      className={cn(
        "overflow-auto",
        // Thin custom scrollbar
        "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300",
        "hover:[&::-webkit-scrollbar-thumb]:bg-slate-400",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
