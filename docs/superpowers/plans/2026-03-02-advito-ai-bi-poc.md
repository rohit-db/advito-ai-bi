# Advito AI-BI POC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Databricks App with an APEX-branded React shell that embeds a Lakeview dashboard and provides a collapsible "Ask APEX" Genie chat panel with SSE streaming.

**Architecture:** FastAPI backend serves a React/Vite SPA. The SPA renders a sidebar + header shell around an embedded Lakeview dashboard iframe. A collapsible right-side panel streams Genie API responses via SSE. Auth uses OBO in production, PAT in local dev.

**Tech Stack:** Python (FastAPI, uvicorn, databricks-sdk, sse-starlette), TypeScript (React 19, Vite, Tailwind CSS 4, React Router, Lucide icons)

**Reference:** `~/Documents/github/bcd-demo/bcd-shopping-app/` for proven patterns.

**Workspace:** https://dbc-1e27e56a-90cd.cloud.databricks.com/?o=1048934788948873
**Dashboard:** `01f1169e4b5810418541b22a792aa916` (NYC Taxi Trip, published)
**Genie Space:** `01f0dc0bf5ce1e3088ad455c5f489911` (Genie - Cloud Venture)
**Warehouse:** `5cd3a4956df6152f` (APEX_sql_warehouse)

---

## Task 1: Scaffold FastAPI Backend

**Files:**
- Create: `app.py`
- Create: `server/__init__.py`
- Create: `server/config.py`
- Create: `server/routes/__init__.py`
- Create: `server/routes/api.py`
- Create: `requirements.txt`

**Step 1: Create `requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.31.0
databricks-sdk==0.38.0
sse-starlette==2.1.0
pydantic==2.9.0
python-dotenv==1.0.1
```

**Step 2: Create `server/config.py`**

```python
import os
from dotenv import load_dotenv
from databricks.sdk import WorkspaceClient

load_dotenv()

IS_DATABRICKS_APP = bool(os.environ.get("DATABRICKS_APP_NAME"))
WORKSPACE_URL = os.environ.get("workspace_url", "https://dbc-1e27e56a-90cd.cloud.databricks.com")
DASHBOARD_URL = os.environ.get(
    "DASHBOARD_URL",
    "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1169e4b5810418541b22a792aa916/published?o=1048934788948873",
)
GENIE_SPACE_ID = os.environ.get("GENIE_SPACE_ID", "01f0dc0bf5ce1e3088ad455c5f489911")
WAREHOUSE_ID = os.environ.get("WAREHOUSE_ID", "5cd3a4956df6152f")


def get_workspace_client() -> WorkspaceClient:
    if IS_DATABRICKS_APP:
        return WorkspaceClient()
    return WorkspaceClient(
        host=WORKSPACE_URL,
        token=os.environ.get("token"),
    )
```

**Step 3: Create `server/routes/api.py`**

```python
from fastapi import APIRouter
from ..config import DASHBOARD_URL

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/config")
def get_config():
    return {"dashboardUrl": DASHBOARD_URL}
```

**Step 4: Create `server/__init__.py` and `server/routes/__init__.py`**

Both empty files.

**Step 5: Create `app.py`**

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI(title="APEX - Advito Practice Exchange")

from server.routes.api import router as api_router

app.include_router(api_router, prefix="/api")

frontend_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dir):
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
```

**Step 6: Verify backend starts**

Run: `cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi && pip install -r requirements.txt && python -m uvicorn app:app --port 8000`
Expected: Server starts, `GET http://localhost:8000/api/health` returns `{"status":"ok"}`

**Step 7: Commit**

```bash
git add app.py requirements.txt server/
git commit -m "feat: scaffold FastAPI backend with config and health endpoint"
```

---

## Task 2: Scaffold React/Vite Frontend

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`

**Step 1: Create `frontend/package.json`**

```json
{
  "name": "advito-ai-bi",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.563.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.13.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.18",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "tailwindcss": "^4.1.18",
    "typescript": "~5.9.3",
    "vite": "^7.3.1"
  }
}
```

**Step 2: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

**Step 3: Create `frontend/tsconfig.json`**

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

**Step 4: Create `frontend/tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src"]
}
```

**Step 5: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>APEX - Advito Practice Exchange</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create `frontend/src/index.css`**

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --color-apex-purple: #4f46e5;
  --color-apex-purple-dark: #3730a3;
  --color-apex-sidebar: #1e1b4b;
  --color-apex-sidebar-hover: #312e81;
  --color-apex-bg: #f8fafc;
  --color-apex-border: #e2e8f0;
}

html, body, #root {
  height: 100%;
  margin: 0;
}
```

**Step 7: Create `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 8: Create `frontend/src/App.tsx`** (placeholder)

```tsx
export default function App() {
  return (
    <div className="h-full flex items-center justify-center bg-apex-bg">
      <h1 className="text-2xl font-semibold text-apex-purple">APEX — Loading...</h1>
    </div>
  );
}
```

**Step 9: Install and verify**

Run: `cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend && npm install && npm run dev`
Expected: Vite dev server at `http://localhost:5173`, shows "APEX — Loading..."

**Step 10: Commit**

```bash
git add frontend/package.json frontend/tsconfig*.json frontend/vite.config.ts frontend/index.html frontend/src/
git commit -m "feat: scaffold React/Vite frontend with Tailwind"
```

---

## Task 3: Build Sidebar + Header + Layout Shell

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create `frontend/src/components/Sidebar.tsx`**

Matches the Figma mockup: two sections (INSIGHTS & ANALYTICS + EXPLORATION), APEX branding at top.

```tsx
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
```

**Step 2: Create `frontend/src/components/Header.tsx`**

```tsx
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
```

**Step 3: Update `frontend/src/App.tsx`**

```tsx
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

export default function App() {
  const [activePath, setActivePath] = useState("/");
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="h-full flex">
      <Sidebar activePath={activePath} onNavigate={setActivePath} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header chatOpen={chatOpen} onToggleChat={() => setChatOpen(!chatOpen)} />
        <div className="flex-1 flex min-h-0">
          {/* Main content */}
          <main className="flex-1 bg-apex-bg p-0 min-w-0">
            <div className="h-full flex items-center justify-center text-gray-400">
              Dashboard will be embedded here
            </div>
          </main>

          {/* Ask APEX panel */}
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
```

**Step 4: Verify layout**

Run: `cd frontend && npm run dev`
Expected: APEX sidebar on left, header with "Ask APEX" toggle, placeholder main area. Clicking "Ask APEX" slides in right panel.

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: APEX-branded sidebar, header, and layout shell"
```

---

## Task 4: Embed Lakeview Dashboard

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create `frontend/src/pages/Dashboard.tsx`**

```tsx
interface DashboardProps {
  dashboardUrl: string;
}

export default function Dashboard({ dashboardUrl }: DashboardProps) {
  return (
    <iframe
      src={dashboardUrl}
      className="w-full h-full border-0"
      title="APEX Dashboard"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
```

**Step 2: Update `frontend/src/App.tsx` — replace main placeholder**

Replace the `<main>` section with:

```tsx
import Dashboard from "./pages/Dashboard";

// Inside App component, add state:
const [dashboardUrl] = useState(
  "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1169e4b5810418541b22a792aa916/published?o=1048934788948873"
);

// Replace the <main> element:
<main className="flex-1 bg-apex-bg p-0 min-w-0">
  <Dashboard dashboardUrl={dashboardUrl} />
</main>
```

Full updated App.tsx:

```tsx
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
```

**Step 3: Verify embedding**

Run: `cd frontend && npm run dev`
Expected: NYC Taxi dashboard renders inside the APEX shell. Dashboard resizes when chat panel toggles.

> **NOTE:** The embed URL requires auth. Locally, this may show a login prompt or blank iframe. That's expected — it will work when deployed as a Databricks App with OBO auth. For local testing, verify the iframe renders and resizes correctly.

**Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: embed Lakeview dashboard in APEX shell"
```

---

## Task 5: Build Genie Chat Backend (SSE)

**Files:**
- Create: `server/routes/genie.py`
- Modify: `app.py` — add genie router

**Step 1: Create `server/routes/genie.py`**

```python
import json
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from sse_starlette.sse import EventSourceResponse
from ..config import get_workspace_client, GENIE_SPACE_ID

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


@router.post("/chat")
async def chat(req: ChatRequest):
    async def event_stream():
        w = get_workspace_client()
        space_id = GENIE_SPACE_ID

        if not space_id:
            yield {"data": json.dumps({"type": "error", "content": "GENIE_SPACE_ID not configured"})}
            return

        try:
            # Start or continue conversation
            if req.conversation_id:
                resp = w.genie.create_message(
                    space_id=space_id,
                    conversation_id=req.conversation_id,
                    content=req.message,
                )
            else:
                resp = w.genie.start_conversation(
                    space_id=space_id,
                    content=req.message,
                )

            conversation_id = resp.conversation_id
            message_id = resp.message_id

            # Send conversation_id immediately so frontend can track it
            yield {"data": json.dumps({"type": "meta", "conversationId": conversation_id})}

            # Poll for completion
            msg = None
            for _ in range(60):
                msg = w.genie.get_message(
                    space_id=space_id,
                    conversation_id=conversation_id,
                    message_id=message_id,
                )
                status = msg.status.value if hasattr(msg.status, "value") else str(msg.status)
                if status in ("COMPLETED", "QUERY_RESULT_EXPIRED"):
                    break
                if status in ("FAILED", "CANCELLED"):
                    yield {"data": json.dumps({"type": "error", "content": f"Query {status}"})}
                    return
                yield {"data": json.dumps({"type": "status", "content": "Thinking..."})}
                time.sleep(2)
            else:
                yield {"data": json.dumps({"type": "error", "content": "Query timed out"})}
                return

            # Process attachments
            for att in msg.attachments or []:
                att_dict = att.as_dict() if hasattr(att, "as_dict") else {}
                att_id = att_dict.get("attachment_id")

                text_block = att_dict.get("text")
                if text_block and text_block.get("content"):
                    yield {"data": json.dumps({"type": "text", "content": text_block["content"]})}

                query_block = att_dict.get("query")
                if query_block and query_block.get("query"):
                    result_data = None
                    if att_id:
                        try:
                            qr = w.genie.get_message_query_result(
                                space_id=space_id,
                                conversation_id=conversation_id,
                                message_id=message_id,
                                attachment_id=att_id,
                            )
                            sr = qr.statement_response
                            if sr and sr.result and sr.result.data_array:
                                columns = [
                                    {"name": c.name, "type": c.type_name.value if hasattr(c.type_name, "value") else str(c.type_name)}
                                    for c in sr.manifest.schema.columns
                                ]
                                result_data = {"columns": columns, "rows": sr.result.data_array[:50]}
                        except Exception:
                            pass

                    yield {"data": json.dumps({
                        "type": "query",
                        "description": query_block.get("description", ""),
                        "sql": query_block["query"],
                        "data": result_data,
                    })}

            yield {"data": "[DONE]"}

        except Exception as e:
            yield {"data": json.dumps({"type": "error", "content": str(e)})}

    return EventSourceResponse(event_stream())
```

**Step 2: Update `app.py` — add genie router**

Add after the api_router import:

```python
from server.routes.genie import router as genie_router
app.include_router(genie_router, prefix="/api")
```

Full `app.py`:

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI(title="APEX - Advito Practice Exchange")

from server.routes.api import router as api_router
from server.routes.genie import router as genie_router

app.include_router(api_router, prefix="/api")
app.include_router(genie_router, prefix="/api")

frontend_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dir):
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
```

**Step 3: Test the endpoint**

Run: `python -m uvicorn app:app --port 8000 --reload`
Test: `curl -X POST http://localhost:8000/api/chat -H "Content-Type: application/json" -d '{"message": "What are the top pickup locations?"}'`
Expected: SSE stream with `data: {"type": "text", ...}` events

**Step 4: Commit**

```bash
git add app.py server/routes/genie.py
git commit -m "feat: Genie API chat endpoint with SSE streaming"
```

---

## Task 6: Build Chat UI with SSE Hook

**Files:**
- Create: `frontend/src/hooks/useChat.ts`
- Create: `frontend/src/components/ChatSection.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create `frontend/src/hooks/useChat.ts`**

```typescript
import { useState, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sql?: string;
  data?: { columns: { name: string; type: string }[]; rows: string[][] } | null;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, conversation_id: conversationId }),
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let assistantSql: string | undefined;
        let assistantData: ChatMessage["data"] = null;

        if (!reader) return;

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload);
              if (event.type === "meta") {
                setConversationId(event.conversationId);
              } else if (event.type === "text") {
                assistantContent += event.content;
              } else if (event.type === "query") {
                if (event.description) assistantContent += event.description + "\n";
                assistantSql = event.sql;
                assistantData = event.data;
              } else if (event.type === "error") {
                assistantContent += "Error: " + event.content;
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        if (assistantContent || assistantSql) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: assistantContent || "Here are the results:",
              sql: assistantSql,
              data: assistantData,
            },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
```

**Step 2: Create `frontend/src/components/ChatSection.tsx`**

```tsx
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, X, Code } from "lucide-react";
import { useChat, type ChatMessage } from "../hooks/useChat";

interface ChatSectionProps {
  onClose: () => void;
}

function DataTable({ data }: { data: NonNullable<ChatMessage["data"]> }) {
  return (
    <div className="overflow-auto max-h-48 mt-2 rounded border border-gray-200 text-xs">
      <table className="w-full">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {data.columns.map((col) => (
              <th key={col.name} className="px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap">
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-100">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChatSection({ onClose }: ChatSectionProps) {
  const { messages, isLoading, sendMessage } = useChat();
  const [input, setInput] = useState("");
  const [showSql, setShowSql] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <aside className="w-[350px] border-l border-apex-border bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-apex-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ask APEX</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-sm text-gray-400 text-center mt-8">
            Ask a question about your data
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-apex-purple text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sql && (
                <button
                  onClick={() => setShowSql(showSql === i ? null : i)}
                  className="flex items-center gap-1 mt-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Code size={12} /> {showSql === i ? "Hide SQL" : "Show SQL"}
                </button>
              )}
              {showSql === i && msg.sql && (
                <pre className="mt-1 p-2 bg-gray-800 text-green-300 rounded text-xs overflow-auto max-h-32">
                  {msg.sql}
                </pre>
              )}
              {msg.data && <DataTable data={msg.data} />}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-apex-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-apex-purple/30 focus:border-apex-purple"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-apex-purple text-white rounded-lg hover:bg-apex-purple-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </aside>
  );
}
```

**Step 3: Update `frontend/src/App.tsx` — wire in ChatSection**

```tsx
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import ChatSection from "./components/ChatSection";

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
          {chatOpen && <ChatSection onClose={() => setChatOpen(false)} />}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Test end-to-end locally**

Run backend: `python -m uvicorn app:app --port 8000 --reload`
Run frontend: `cd frontend && npm run dev`
1. Open http://localhost:5173
2. Verify sidebar + header + dashboard placeholder render
3. Click "Ask APEX" — right panel slides in, dashboard resizes
4. Type a question — sends to `/api/chat`, SSE streams back
5. Response renders with text + optional SQL + data table

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: Ask APEX chat panel with SSE streaming from Genie API"
```

---

## Task 7: Create app.yaml and Build for Deployment

**Files:**
- Create: `app.yaml`

**Step 1: Create `app.yaml`**

```yaml
command:
  - "python"
  - "-m"
  - "uvicorn"
  - "app:app"
  - "--host"
  - "0.0.0.0"
  - "--port"
  - "8000"

env:
  - name: DASHBOARD_URL
    value: "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1169e4b5810418541b22a792aa916/published?o=1048934788948873"
  - name: GENIE_SPACE_ID
    value: "01f0dc0bf5ce1e3088ad455c5f489911"
  - name: WAREHOUSE_ID
    value: "5cd3a4956df6152f"

resources:
  - name: sql-warehouse
    sql_warehouse:
      id: "5cd3a4956df6152f"
      permission: CAN_USE
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`
Expected: `frontend/dist/` directory created with compiled assets

**Step 3: Test production mode locally**

Run: `python -m uvicorn app:app --port 8000`
Open: `http://localhost:8000`
Expected: FastAPI serves the built React SPA. All routes work.

**Step 4: Commit**

```bash
git add app.yaml
git commit -m "feat: add app.yaml for Databricks App deployment"
```

---

## Task 8: Deploy to BCD Workspace

**Step 1: Configure Databricks CLI for BCD workspace**

Run: `databricks configure --host https://dbc-1e27e56a-90cd.cloud.databricks.com --token`
Enter the PAT from `.env`

Or set profile:
```bash
export DATABRICKS_HOST="https://dbc-1e27e56a-90cd.cloud.databricks.com"
export DATABRICKS_TOKEN="<token-from-env>"
```

**Step 2: Create and deploy the app**

Run:
```bash
databricks apps create advito-ai-bi --description "APEX - AI/BI Embedding POC"
databricks apps deploy advito-ai-bi --source-code-path .
```

**Step 3: Verify deployment**

Open: The app URL returned by the deploy command
Expected: APEX shell with embedded NYC Taxi dashboard, "Ask APEX" chat working with OBO auth

**Step 4: Document results**

For each requirement, open the deployed app and test:
- REQ-1: Does "Ask Genie" text appear anywhere? Screenshot.
- REQ-2: Is "Powered by Databricks" visible? Screenshot.
- REQ-3: Click through dashboard — any console links? Screenshot.
- REQ-6: Resize browser — does layout respond? Screenshot.
- REQ-8: Ask a question — does "Ask APEX" branded chat work? Screenshot.
- REQ-9: Add URL params to dashboard embed — do filters apply? Screenshot.

Save screenshots to `docs/screenshots/poc-results/`

**Step 5: Commit results**

```bash
git add docs/
git commit -m "docs: POC test results for embedding requirements"
```

---

## Summary

| Task | What | Est. |
|------|------|------|
| 1 | FastAPI backend scaffold | 5 min |
| 2 | React/Vite frontend scaffold | 5 min |
| 3 | Sidebar + Header + Layout | 10 min |
| 4 | Dashboard iframe embedding | 5 min |
| 5 | Genie chat backend (SSE) | 10 min |
| 6 | Chat UI + SSE hook | 10 min |
| 7 | app.yaml + production build | 5 min |
| 8 | Deploy + document results | 15 min |

**Total: ~65 min for Phase 1**

Phase 2 (MAS upgrade) is a separate plan once Phase 1 is validated.
