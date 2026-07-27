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
  accent = "indigo",
}: {
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
  accent?: "indigo" | "fuchsia";
}) {
  const accentText = accent === "fuchsia" ? "text-fuchsia-600" : "text-brand-primary";
  const accentBtn =
    accent === "fuchsia"
      ? "from-fuchsia-600 to-brand-primary"
      : "from-brand-primary to-brand-accent";
  const activeBg = accent === "fuchsia" ? "bg-fuchsia-50 text-fuchsia-900" : "bg-brand-primary-light text-brand-primary-dark";
  const activeBar = accent === "fuchsia" ? "bg-fuchsia-500" : "bg-brand-accent";
  const activeIcon = accent === "fuchsia" ? "text-fuchsia-600" : "text-brand-primary";
  const activeTitle = accent === "fuchsia" ? "text-fuchsia-900" : "text-brand-primary-dark";

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex shrink-0 items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 text-slate-700">
          <History size={15} className={accentText} />
          <span className="text-sm font-semibold">History</span>
        </div>
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          title="New conversation"
          className={`flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br ${accentBtn} text-white shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs leading-relaxed text-slate-400">
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
                className={`group relative flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                  active ? activeBg : "hover:bg-slate-50"
                }`}
              >
                {active && (
                  <span className={`absolute inset-y-1.5 left-0 w-0.5 rounded-full ${activeBar}`} />
                )}
                <MessageSquare
                  size={14}
                  className={`mt-0.5 shrink-0 ${active ? activeIcon : "text-slate-400"}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[13px] font-medium ${
                      active ? activeTitle : "text-slate-700"
                    }`}
                  >
                    {c.title}
                  </p>
                  <p className="text-[11px] text-slate-400">{formatRelative(c.updated_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  title="Delete conversation"
                  className="shrink-0 p-1 text-slate-300 opacity-0 transition-all hover:text-rose-500 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="shrink-0 border-t border-slate-100 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          History stored in <span className={`font-semibold ${accentText}`}>Lakebase</span>
        </p>
      </div>
    </aside>
  );
}
