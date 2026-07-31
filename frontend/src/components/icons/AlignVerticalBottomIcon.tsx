import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface AlignVerticalBottomIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const AlignVerticalBottomIcon = forwardRef<SVGSVGElement, AlignVerticalBottomIconProps>(
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
              d="M15 13.5V15H1v-1.5zM8.75 1v8.19l1.72-1.72 1.06 1.06L8 12.06 4.47 8.53l1.06-1.06 1.72 1.72V1z"
            />
    </svg>
  )
);
AlignVerticalBottomIcon.displayName = "AlignVerticalBottomIcon";
