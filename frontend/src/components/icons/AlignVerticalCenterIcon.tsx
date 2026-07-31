import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface AlignVerticalCenterIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const AlignVerticalCenterIcon = forwardRef<SVGSVGElement, AlignVerticalCenterIconProps>(
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
              d="m11.53 12.97-1.06 1.06-1.72-1.72V16h-1.5v-3.69l-1.72 1.72-1.06-1.06L8 9.44zM15 8.75H1v-1.5h14zM8.75 3.69l1.72-1.72 1.06 1.06L8 6.56 4.47 3.03l1.06-1.06 1.72 1.72V0h1.5z"
            />
    </svg>
  )
);
AlignVerticalCenterIcon.displayName = "AlignVerticalCenterIcon";
