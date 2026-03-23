import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextValue>({
  value: "",
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
});

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Select({ value, defaultValue = "", onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const activeValue = value !== undefined ? value : internalValue;

  const handleChange = (v: string) => {
    if (value === undefined) setInternalValue(v);
    onValueChange?.(v);
    setOpen(false);
  };

  return (
    <SelectContext.Provider value={{ value: activeValue, onValueChange: handleChange, open, setOpen }}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  placeholder?: string;
}

export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  const { open, setOpen } = useContext(SelectContext);

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2",
        "text-sm text-slate-900 shadow-sm",
        "hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      aria-haspopup="listbox"
      aria-expanded={open}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn(
          "ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform",
          open && "rotate-180"
        )}
      />
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = useContext(SelectContext);
  return (
    <span className={cn("block truncate", !value && "text-slate-400")}>
      {value || placeholder || "Select..."}
    </span>
  );
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SelectContent({ className, children, ...props }: SelectContentProps) {
  const { open, setOpen } = useContext(SelectContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-md border border-slate-200",
        "bg-white text-slate-900 shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      role="listbox"
      {...props}
    >
      <div className="p-1">{children}</div>
    </div>
  );
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function SelectItem({ className, value, children, ...props }: SelectItemProps) {
  const { value: selectedValue, onValueChange } = useContext(SelectContext);
  const isSelected = selectedValue === value;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => onValueChange(value)}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        "hover:bg-indigo-50 hover:text-indigo-900 transition-colors",
        isSelected && "bg-indigo-50 font-medium text-indigo-900",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
