import React from "react";
import { cn } from "../../lib/utils";

interface TooltipProviderProps {
  children: React.ReactNode;
}

// Provider is a no-op — included for API compatibility with shadcn usage patterns
export function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>;
}

interface TooltipProps {
  children: React.ReactNode;
  content?: string;
}

// Simple title-attribute tooltip wrapper
export function Tooltip({ children, content }: TooltipProps) {
  return (
    <span title={content} className="inline-flex">
      {children}
    </span>
  );
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
}

export function TooltipTrigger({ className, children, asChild, ...props }: TooltipTriggerProps) {
  return (
    <span className={cn("inline-flex", className)} {...props}>
      {children}
    </span>
  );
}

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right";
}

// Hidden — tooltip is handled via title attribute on the wrapper
export function TooltipContent({ className, children, side: _side, ...props }: TooltipContentProps) {
  return null;
}
