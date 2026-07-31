import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface StepAfterLineIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const StepAfterLineIcon = forwardRef<SVGSVGElement, StepAfterLineIconProps>(
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
              d="M1.5 14a1.5 1.5 0 1 1 1.298-2.25H5V6.299A1.499 1.499 0 1 1 7.048 4.25H9.75a.75.75 0 0 1 .75.75v3.202c.227.132.416.32.548.548H13.5V5.049a1.5 1.5 0 1 1 1.5 0V9.5a.75.75 0 0 1-.75.75h-3.202A1.498 1.498 0 1 1 9 8.202V5.75H7.048c-.132.227-.32.417-.548.549V12.5a.75.75 0 0 1-.75.75H2.798c-.26.448-.743.75-1.298.75"
            />
    </svg>
  )
);
StepAfterLineIcon.displayName = "StepAfterLineIcon";
