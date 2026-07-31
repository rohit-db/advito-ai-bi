import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TrendingIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const TrendingIcon = forwardRef<SVGSVGElement, TrendingIconProps>(
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
              stroke="currentColor"
              d="M7.074 2.08q.074 0 .138.034l.014.008.016.008c1.873.87 3.287 2.264 4.146 3.788.634 1.123.959 2.304.956 3.387l-.005.215c-.047 1.087-.435 2.062-1.156 2.765-.718.7-1.774 1.136-3.172 1.139h-.03A4.076 4.076 0 0 1 3.657 9.52a3.37 3.37 0 0 1 1.676-2.995c.237.52.561.994.96 1.4l.403.412.35-.457c.52-.678.741-1.53.735-2.42-.008-1.058-.338-2.173-.882-3.117l-.005-.007-.021-.057a.17.17 0 0 1 .06-.162.3.3 0 0 1 .14-.038Z"
              opacity={0.8}
            />
    </svg>
  )
);
TrendingIcon.displayName = "TrendingIcon";
