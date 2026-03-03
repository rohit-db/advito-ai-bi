import { MessageCircle, User } from "lucide-react";

interface HeaderProps {
  chatOpen: boolean;
  onToggleChat: () => void;
}

export default function Header({ chatOpen, onToggleChat }: HeaderProps) {
  return (
    <header className="h-12 bg-white border-b border-apex-border flex items-center justify-between px-4 shrink-0">
      {/* Client */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-indigo-600">CloudVenture</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            chatOpen
              ? "bg-apex-purple text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <MessageCircle size={14} />
          Ask APEX
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
            <User size={14} className="text-indigo-600" />
          </div>
          John Doe
        </div>
      </div>
    </header>
  );
}
