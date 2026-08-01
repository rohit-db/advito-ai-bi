import { History, MessageSquare, Plus, Trash2 } from "lucide-react";
import type { ConversationMeta } from "@/config";

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Left-hand Lakebase conversation history rail, shared by the Ask APEX pages.
export default function ConversationRail({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  disabled,
}: {
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-secondary">
      <div className="flex shrink-0 items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <History size={15} className="text-muted-foreground" />
          <span className="text-sm font-semibold">History</span>
        </div>
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          title="New conversation"
          className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground shadow-db-xs transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs leading-relaxed text-muted-foreground">
            Your conversations appear here.
            <br />
            Ask a question to start one.
          </p>
        ) : (
          conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`group relative flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 transition-colors ${
                  active ? "bg-primary/10 text-foreground" : "hover:bg-[var(--action-default-bg-hover)]"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                )}
                <MessageSquare
                  size={14}
                  className={`mt-0.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[13px] font-medium ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {c.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatRelative(c.updated_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  title="Delete conversation"
                  className="shrink-0 p-1 text-muted-foreground opacity-0 transition-all hover:text-[var(--destructive)] group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="shrink-0 border-t border-border px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          History stored in <span className="font-semibold text-primary">Lakebase</span>
        </p>
      </div>
    </aside>
  );
}
