import React from "react";
import { cn } from "../../lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg";
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  default: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

export function Avatar({ className, size = "default", children, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {}

export function AvatarFallback({ className, children, ...props }: AvatarFallbackProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-slate-200 text-slate-700 font-medium",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

export function AvatarImage({ className, alt = "", ...props }: AvatarImageProps) {
  return (
    <img
      className={cn("aspect-square h-full w-full object-cover", className)}
      alt={alt}
      {...props}
    />
  );
}
