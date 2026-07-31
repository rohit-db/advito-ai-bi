import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface SqlIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const SqlIcon = forwardRef<SVGSVGElement, SqlIconProps>(
  ({ size = 16, className, ariaLabel, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 17"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      {...props}
    >
      <path
              fill="currentColor"
              fillRule="evenodd"
              d="M8.25 8A2.75 2.75 0 0 1 11 10.75v1.5c0 .616-.206 1.183-.548 1.642l1.078 1.078-1.06 1.06-1.221-1.22A2.75 2.75 0 0 1 5.5 12.25v-1.5A2.75 2.75 0 0 1 8.25 8m0 1.5c-.69 0-1.25.56-1.25 1.25v1.5a1.25 1.25 0 1 0 2.5 0v-1.5c0-.69-.56-1.25-1.25-1.25"
              clipRule="evenodd"
            />
            <path
              fill="currentColor"
              d="M2.75 8A2.25 2.25 0 0 1 5 10.25v.25H3.5v-.25a.75.75 0 0 0-.75-.75h-.192a.558.558 0 0 0-.177 1.087l1.212.403a2.058 2.058 0 0 1-.65 4.01H2.75A2.25 2.25 0 0 1 .5 12.75v-.25H2v.25c0 .414.336.75.75.75h.192a.558.558 0 0 0 .177-1.087l-1.212-.403A2.058 2.058 0 0 1 2.557 8zM13.5 13.5h2V15h-2.75a.75.75 0 0 1-.75-.75V8h1.5z"
            />
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M9 0a.75.75 0 0 1 .547.237l3.75 4a.75.75 0 0 1 .203.513V6.5H12v-1H9a.75.75 0 0 1-.75-.75V1.5H4v5H2.5V.75A.75.75 0 0 1 3.25 0zm.75 4h1.27L9.75 2.646z"
              clipRule="evenodd"
            />
    </svg>
  )
);
SqlIcon.displayName = "SqlIcon";
