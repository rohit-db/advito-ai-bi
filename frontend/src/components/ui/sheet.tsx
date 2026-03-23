import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open = false, onOpenChange, children }: SheetProps) {
  // Provide context via clone or direct render — children use SheetContent
  return (
    <>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        // Pass open/onOpenChange as props to SheetContent
        if ((child.type as React.FC).displayName === "SheetContent") {
          return React.cloneElement(child as React.ReactElement<SheetContentProps>, {
            open,
            onClose: () => onOpenChange?.(false),
          });
        }
        return child;
      })}
    </>
  );
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "right" | "left" | "top" | "bottom";
  open?: boolean;
  onClose?: () => void;
}

const sideClasses = {
  right: "inset-y-0 right-0 h-full w-3/4 max-w-sm translate-x-full data-[open=true]:translate-x-0",
  left: "inset-y-0 left-0 h-full w-3/4 max-w-sm -translate-x-full data-[open=true]:translate-x-0",
  top: "inset-x-0 top-0 w-full h-auto -translate-y-full data-[open=true]:translate-y-0",
  bottom: "inset-x-0 bottom-0 w-full h-auto translate-y-full data-[open=true]:translate-y-0",
};

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, side = "right", open = false, onClose, children, ...props }, ref) => {
    // Lock body scroll when open
    useEffect(() => {
      if (open) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
      return () => {
        document.body.style.overflow = "";
      };
    }, [open]);

    // Close on Escape
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape" && open) onClose?.();
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Panel */}
        <div
          ref={ref}
          data-open={open}
          className={cn(
            "fixed z-50 flex flex-col bg-white shadow-xl",
            "transition-transform duration-300 ease-in-out",
            sideClasses[side],
            // When rendered (open=true), remove the translate
            side === "right" && "translate-x-0",
            side === "left" && "translate-x-0",
            side === "top" && "translate-y-0",
            side === "bottom" && "translate-y-0",
            className
          )}
          role="dialog"
          aria-modal="true"
          {...props}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-opacity"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          {children}
        </div>
      </>,
      document.body
    );
  }
);

SheetContent.displayName = "SheetContent";

interface SheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SheetHeader({ className, children, ...props }: SheetHeaderProps) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-6 pb-0", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface SheetTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function SheetTitle({ className, children, ...props }: SheetTitleProps) {
  return (
    <h2
      className={cn("text-lg font-semibold text-slate-900 leading-none tracking-tight", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

interface SheetDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function SheetDescription({ className, children, ...props }: SheetDescriptionProps) {
  return (
    <p className={cn("text-sm text-slate-500", className)} {...props}>
      {children}
    </p>
  );
}
