import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface SidebarClosedIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const SidebarClosedIcon = forwardRef<SVGSVGElement, SidebarClosedIconProps>(
  ({ size = 16, className, ariaLabel, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      {...props}
    >
      <path
              fill="currentColor"
              d="M3.75 4.25A.75.75 0 0 1 4.5 5v6A.75.75 0 0 1 3 11V5a.75.75 0 0 1 .75-.75"
            />
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M13 1a3 3 0 0 1 3 3v8l-.004.154A3 3 0 0 1 13 15H3l-.154-.004a3 3 0 0 1-2.842-2.842L0 12V4a3 3 0 0 1 3-3zM3 2.5A1.5 1.5 0 0 0 1.5 4v8A1.5 1.5 0 0 0 3 13.5h10a1.5 1.5 0 0 0 1.5-1.5V4A1.5 1.5 0 0 0 13 2.5z"
              clipRule="evenodd"
            />
    </svg>
  )
);
SidebarClosedIcon.displayName = "SidebarClosedIcon";
