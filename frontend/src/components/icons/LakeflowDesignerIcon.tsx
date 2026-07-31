import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface LakeflowDesignerIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Default: 16 (DuBois standard). */
  size?: number | string;
  className?: string;
  /** Accessible label. When set, icon gets role="img". */
  ariaLabel?: string;
}

export const LakeflowDesignerIcon = forwardRef<SVGSVGElement, LakeflowDesignerIconProps>(
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
              fillRule="evenodd"
              d="M5.75 1a.75.75 0 0 1 .75.75v2.19l2.72-2.72.114-.094a.75.75 0 0 1 .946.094l4.5 4.5a.75.75 0 0 1 0 1.06L12.06 9.5h2.19a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-.75.75h-4a.75.75 0 0 1-.75-.75V11h-3v3.25a.75.75 0 0 1-.75.75h-4a.75.75 0 0 1-.75-.75v-4a.75.75 0 0 1 .75-.75H5v-3H1.75A.75.75 0 0 1 1 5.75v-4A.75.75 0 0 1 1.75 1zM2.5 13.5H5V11H2.5zm8.5 0h2.5V11H11zM6.5 6.06V9.5h3.44l3.25-3.25-3.44-3.44zM2.5 5H5V2.5H2.5z"
              clipRule="evenodd"
            />
    </svg>
  )
);
LakeflowDesignerIcon.displayName = "LakeflowDesignerIcon";
