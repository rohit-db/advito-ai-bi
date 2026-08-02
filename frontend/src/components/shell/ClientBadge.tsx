export default function ClientBadge({ tenant }: { tenant: string }) {
  return (
    <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
      </span>
      <div className="flex items-baseline gap-1.5 min-w-0 leading-none">
        <span className="text-[9px] text-muted-foreground tracking-[0.14em] uppercase">Client</span>
        <span className="text-xs font-semibold text-foreground truncate">{tenant}</span>
      </div>
    </div>
  );
}
