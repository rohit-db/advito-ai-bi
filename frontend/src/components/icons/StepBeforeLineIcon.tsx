import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface StepBeforeLineIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const StepBeforeLineIcon = forwardRef<SVGSVGElement, StepBeforeLineIconProps>(
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
              d="M14.5 2.25a1.5 1.5 0 1 1-1.298 2.25H11v5.451A1.5 1.5 0 1 1 8.952 12H6.25a.75.75 0 0 1-.75-.75V8.048a1.5 1.5 0 0 1-.548-.548H2.5v3.701a1.499 1.499 0 1 1-1.5 0V6.75A.75.75 0 0 1 1.75 6h3.202A1.498 1.498 0 1 1 7 8.048V10.5h1.952c.132-.227.32-.417.548-.549V3.75a.75.75 0 0 1 .75-.75h2.952c.26-.448.743-.75 1.298-.75"
            />
    </svg>
  )
);
StepBeforeLineIcon.displayName = "StepBeforeLineIcon";
