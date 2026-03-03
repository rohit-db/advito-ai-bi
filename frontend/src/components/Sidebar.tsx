import {
  DollarSign,
  Users,
  TrendingUp,
  ShieldCheck,
  Heart,
  Leaf,
  Zap,
  FileText,
  Database,
  MessageCircle,
  UsersRound,
} from "lucide-react";

const insightsItems = [
  { label: "Spend", icon: DollarSign, path: "/" },
  { label: "Suppliers", icon: Users, path: "/suppliers" },
  { label: "Demand MGT", icon: TrendingUp, path: "/demand" },
  { label: "Compliance", icon: ShieldCheck, path: "/compliance" },
  { label: "Well-Being", icon: Heart, path: "/well-being" },
  { label: "Sustainability", icon: Leaf, path: "/sustainability" },
  { label: "Engage", icon: Zap, path: "/engage" },
];

const explorationItems = [
  { label: "Reports", icon: FileText, path: "/reports" },
  { label: "Data Store", icon: Database, path: "/data-store" },
  { label: "APEX Q&A", icon: MessageCircle, path: "/ask-apex" },
  { label: "Community", icon: UsersRound, path: "/community" },
];

interface SidebarProps {
  activePath: string;
  onNavigate: (path: string) => void;
}

export default function Sidebar({ activePath, onNavigate }: SidebarProps) {
  return (
    <aside className="w-52 bg-apex-sidebar text-white flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="text-xl font-bold tracking-tight">APEX</div>
        <div className="text-[10px] text-white/50 tracking-widest uppercase">
          Advito Practice Exchange
        </div>
      </div>

      {/* Insights & Analytics */}
      <div className="px-3 pt-4">
        <div className="text-[10px] text-white/40 font-semibold tracking-widest uppercase px-2 mb-2">
          Insights & Analytics
        </div>
        {insightsItems.map((item) => (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
              activePath === item.path
                ? "bg-apex-purple text-white font-medium"
                : "text-white/70 hover:bg-apex-sidebar-hover hover:text-white"
            }`}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Exploration */}
      <div className="px-3 pt-5">
        <div className="text-[10px] text-white/40 font-semibold tracking-widest uppercase px-2 mb-2">
          Exploration
        </div>
        {explorationItems.map((item) => (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
              activePath === item.path
                ? "bg-apex-purple text-white font-medium"
                : "text-white/70 hover:bg-apex-sidebar-hover hover:text-white"
            }`}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />
    </aside>
  );
}
