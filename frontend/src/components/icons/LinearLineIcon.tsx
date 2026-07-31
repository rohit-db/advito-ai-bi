import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface LinearLineIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const LinearLineIcon = forwardRef<SVGSVGElement, LinearLineIconProps>(
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
              d="M14.5 2a1.5 1.5 0 0 1 .09 2.995L12.25 9.673a1.5 1.5 0 1 1-2.729.572L5.517 6.906q-.203.075-.427.09L2.75 11.672a1.5 1.5 0 1 1-1.342-.669l2.34-4.678a1.5 1.5 0 1 1 2.729-.572l4.004 3.339q.202-.075.426-.09l2.34-4.677A1.5 1.5 0 0 1 14.5 2"
            />
    </svg>
  )
);
LinearLineIcon.displayName = "LinearLineIcon";
