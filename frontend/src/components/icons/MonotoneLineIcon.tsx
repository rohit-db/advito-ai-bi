import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface MonotoneLineIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const MonotoneLineIcon = forwardRef<SVGSVGElement, MonotoneLineIconProps>(
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
              d="M14.5 2a1.5 1.5 0 0 1 .688 2.831c-.107 1.218-.363 2.494-.806 3.578-.404.988-1.027 1.948-1.93 2.46a1.499 1.499 0 0 1-2.877.1 3.2 3.2 0 0 1-1.036-.729c-.548-.567-.91-1.304-1.21-1.905-.324-.648-.588-1.162-.946-1.532a2 2 0 0 0-.309-.26 1.493 1.493 0 0 1-2.06.086c-.374.31-.715.815-1.007 1.53-.369.902-.595 2.002-.695 3.08A1.498 1.498 0 0 1 1.5 14a1.5 1.5 0 0 1-.69-2.832c.108-1.217.365-2.493.808-3.577.404-.988 1.026-1.95 1.929-2.461a1.5 1.5 0 0 1 2.877-.1c.403.176.745.427 1.037.73.548.567.91 1.304 1.21 1.905.324.648.588 1.162.946 1.532q.14.146.308.258a1.495 1.495 0 0 1 2.06-.085c.374-.31.716-.814 1.008-1.53.369-.9.594-2.002.694-3.08A1.498 1.498 0 0 1 14.5 2"
            />
    </svg>
  )
);
MonotoneLineIcon.displayName = "MonotoneLineIcon";
