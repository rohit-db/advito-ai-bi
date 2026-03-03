import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";

const DEFAULT_DASHBOARD =
  "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1169e4b5810418541b22a792aa916/published?o=1048934788948873";

export default function App() {
  const [activePath, setActivePath] = useState("/");
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="h-full flex">
      <Sidebar activePath={activePath} onNavigate={setActivePath} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header chatOpen={chatOpen} onToggleChat={() => setChatOpen(!chatOpen)} />
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 bg-apex-bg p-0 min-w-0">
            <Dashboard dashboardUrl={DEFAULT_DASHBOARD} />
          </main>

          {chatOpen && (
            <aside className="w-[350px] border-l border-apex-border bg-white flex flex-col shrink-0">
              <div className="px-4 py-3 border-b border-apex-border">
                <h2 className="text-sm font-semibold">Ask APEX</h2>
              </div>
              <div className="flex-1 p-4 text-sm text-gray-400">
                Chat will be connected here
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
