import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface PivotOperatorIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const PivotOperatorIcon = forwardRef<SVGSVGElement, PivotOperatorIconProps>(
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
              d="m15.84 9.03-1.06 1.06-.72-.719v1.94a2.75 2.75 0 0 1-2.75 2.75H9.372l.72.72-1.06 1.06L6.5 13.31l2.53-2.53 1.06 1.06-.719.72h1.94c.69 0 1.25-.56 1.25-1.25V9.37l-.72.72-1.06-1.06L13.31 6.5z"
            />
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M14.25 1a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75H5.5v8.75a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-9.5A.75.75 0 0 1 1.75 4H4V1.75A.75.75 0 0 1 4.75 1zM2.5 13.5H4v-8H2.5zm3-9.5h8V2.5h-8z"
              clipRule="evenodd"
            />
    </svg>
  )
);
PivotOperatorIcon.displayName = "PivotOperatorIcon";
