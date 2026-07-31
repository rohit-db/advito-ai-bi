import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface AlignVerticalTopIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const AlignVerticalTopIcon = forwardRef<SVGSVGElement, AlignVerticalTopIconProps>(
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
              d="m4.47 7.47 1.06 1.06 1.72-1.72V15h1.5V6.81l1.72 1.72 1.06-1.06L8 3.94zM1 1v1.5h14V1z"
            />
    </svg>
  )
);
AlignVerticalTopIcon.displayName = "AlignVerticalTopIcon";
