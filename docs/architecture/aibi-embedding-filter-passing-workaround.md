# White-Label AI/BI Dashboard Embedding

> How APEX embeds a **Databricks AI/BI dashboard** so it looks like a native part
> of the app: **no Databricks login**, **no "Powered by Databricks" logo**, **no
> dashboard chrome**, and **filters driven entirely by the host app's own
> FilterBar**.

---

## TL;DR — what & why

A white-label analytics experience can't just drop an AI/BI dashboard in an
`<iframe>`. Basic embedding shows a Databricks login screen, the Databricks logo,
the dashboard's page header, and its own filter widgets — none of which we want.

We solve this with the official **`@databricks/aibi-client` SDK** for what it
supports (token auth/refresh, hide-logo, smooth page navigation) plus a few small,
well-understood techniques layered on top for what it doesn't. The four things
this doc covers:

| # | Technique | Mechanism |
| - | --------- | --------- |
| 1 | Hide the "Powered by Databricks" logo | SDK `config.hideDatabricksLogo`, **re-pushed after every iframe reload** |
| 2 | Push host-app filters into the dashboard | `f_{pageId}~{widgetId}=value` URL params → rebuild the embed URL / iframe |
| 3 | Hide the dashboard's page header | CSS crop of the SDK's iframe (`marginTop: -48px`) |
| 4 | Hide the dashboard's native filter pane | Author all filters on a dedicated page we never embed; drive it via #2 |

All four live in two files: **`frontend/src/pages/CustomDashboard.tsx`** (the SDK
render + techniques 1–4) and **`frontend/src/config.ts`** (the `f_` grammar, the
dashboard registry, the URL builders). The server side is one route,
**`server/routes/embed.py`**, which mints the scoped token.

> `NativeDashboard` (the old raw-iframe page) has been removed. `CustomDashboard`
> is the only embed path today.

---

## How it works (the big picture)

```
 Browser (React)                         Your server (FastAPI)          Databricks
 ────────────────                        ─────────────────────          ──────────
 CustomDashboard
   │  GET /api/embed/token ────────────▶ embed.py
   │                                       │  3-step OAuth exchange ───▶ /oidc/v1/token
   │                                       │  (mints SP-scoped token)   /lakeview/.../tokeninfo
   │  ◀──────────────── { token } ────────┘
   │
   │  new DatabricksDashboard({ token, config:{hideDatabricksLogo} })
   │      └─ SDK appends <iframe src=".../embed/...#token=…">  ───────▶ AI/BI embed SPA
   │
 FilterBar change
   │  reloadWithFilters() → iframe.src = ".../pages/{p}?f_…=…#token=…" ▶ (reloads with filters)
```

- The **server** holds the Service Principal secret and mints a **short-lived,
  dashboard-scoped token**. The browser never sees SP credentials.
- The **browser** hands that token to the SDK, which renders the embed iframe.
  Host-app filter changes rebuild the iframe URL with `f_…` params.

---

## The token mint (3-step OAuth)

External (token) embedding is what removes the Databricks login screen. The
dashboard is **published with `embed_credentials=false`**, so its queries run **as
the Service Principal** — meaning the SP (not the viewer) needs data access.

`server/routes/embed.py` implements the documented [external-embed](https://docs.databricks.com/aws/en/dashboards/share/embedding/external-embed)
exchange:

1. **SP client-credentials → broad `all-apis` token.**
   `POST /oidc/v1/token` with `grant_type=client_credentials&scope=all-apis`,
   authenticated with `Basic base64(client_id:client_secret)`.
2. **Scope it to this dashboard + viewer.**
   `GET /api/2.0/lakeview/dashboards/{id}/published/tokeninfo?external_viewer_id=…&external_value=…`
   with the step-1 bearer token. Returns a `tokeninfo` blob with
   `authorization_details`.
3. **Re-issue as a browser-safe token.**
   `POST /oidc/v1/token` echoing the `tokeninfo` fields, with
   `authorization_details` **JSON-stringified**. Returns the final
   `access_token` (~1h) that goes in the iframe's `#token=` hash.

The 3-step exchange, verified:

```81:129:server/routes/embed.py
def _mint_embed_token(
    dashboard_id: str,
    viewer_id: str,
    external_value: str | None,
    credentials: tuple[str, str] | None = None,
) -> dict:
    instance = WORKSPACE_URL.rstrip("/")
    cid, csec = credentials or _sp_credentials()
    basic = base64.b64encode(f"{cid}:{csec}".encode()).decode()

    # 1) broadly-scoped all-apis token for the SP
    r1 = requests.post(
        f"{instance}/oidc/v1/token",
        headers={"Authorization": f"Basic {basic}",
                 "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials", "scope": "all-apis"},
        timeout=_TIMEOUT,
    )
    r1.raise_for_status()
    oidc_token = r1.json()["access_token"]

    # 2) tokeninfo scoped to this published dashboard + viewer
    params = {"external_viewer_id": viewer_id}
    if external_value is not None:
        params["external_value"] = external_value
    r2 = requests.get(
        f"{instance}/api/2.0/lakeview/dashboards/{dashboard_id}/published/tokeninfo"
        f"?{urllib.parse.urlencode(params)}",
        headers={"Authorization": f"Bearer {oidc_token}"},
        timeout=_TIMEOUT,
    )
    r2.raise_for_status()
    token_info = r2.json()

    # 3) re-issue as a tightly-scoped, browser-safe token
    body = dict(token_info)
    authorization_details = body.pop("authorization_details", None)
    body["grant_type"] = "client_credentials"
    body["authorization_details"] = json.dumps(authorization_details)
    r3 = requests.post(
        f"{instance}/oidc/v1/token",
        headers={"Authorization": f"Basic {basic}",
                 "Content-Type": "application/x-www-form-urlencoded"},
        data=body,
        timeout=_TIMEOUT,
    )
    r3.raise_for_status()
    payload = r3.json()
    return {"token": payload["access_token"], "expires_in": int(payload.get("expires_in", 3600))}
```

**Which SP mints the token (multi-tenant).** `_resolve_embed_credentials(request)`
prefers the **logged-in tenant's** Service Principal, falling back to the app SP
before any tenant is onboarded. Minting as the tenant SP means the dashboard's
warehouse queries run as that SP, so the Unity Catalog row filter (keyed on
`session_user()`) scopes the data — the same isolation control that governs Genie.
Details live in [`../handoff/multi-tenant-isolation.md`](../handoff/multi-tenant-isolation.md);
don't duplicate them here.

```56:78:server/routes/embed.py
def _resolve_embed_credentials(request: Request) -> tuple[str, str]:
    """Prefer the logged-in tenant's Service Principal, else the app SP."""
    try:
        from ..tenants import registry, runtime
        from ..tenants.resolver import tenant_id_for_request

        tid = tenant_id_for_request(request)
        if tid:
            row = registry.get_tenant(tid)
            if row and row.status == "active":
                secret = runtime.secret_for_sp(row.sp_app_id)
                if secret:
                    return row.sp_app_id, secret
    except Exception:  # noqa: BLE001 - never block embedding on the isolation layer
        pass
    return _sp_credentials()
```

The route (`GET /embed/token`, called by the browser as `/api/embed/token`)
derives `viewer_id` / `external_value` from the **server-side session identity**
(`request.state.identity`), so the browser can't spoof its own scope. It resolves
credentials, mints, and returns `{ ok, dashboard_id, token, expires_in }`
(`server/routes/embed.py` lines 132–164). The default dashboard id and workspace
host come from `DASHBOARD_URL` / `WORKSPACE_URL` in `server/config.py`.

> **Gotcha:** each tenant SP must have **`CAN_RUN` on the published dashboard**
> (plus `CAN_USE` on the warehouse and `SELECT` on the data). Without `CAN_RUN`,
> step 2/3 fails with `invalid_authorization_details`.

---

## Technique 1 — Hide the "Powered by Databricks" logo

The SDK accepts `config: { hideDatabricksLogo: true }` at construction, which
removes the footer:

```136:154:frontend/src/pages/CustomDashboard.tsx
      const dash = new DatabricksDashboard({
        instanceUrl,
        workspaceId: orgId,
        dashboardId,
        pageId: currentPageId || undefined,
        token: res.token,
        container: containerRef.current,
        config: { version: 1, hideDatabricksLogo: true },
        getNewToken: async () => {
          const r = await fetchEmbedToken(dashboardId);
          if (r.ok && r.token) tokenRef.current = r.token;
          return r.token || "";
        },
      });
      dash.initialize();
      dashRef.current = dash;
      // The SDK appends its iframe synchronously during initialize(); crop the
      // embedded dashboard's page header (rAF guards against append timing).
      requestAnimationFrame(() => cropIframeHeader(containerRef.current?.querySelector("iframe")));
```

**The non-obvious part:** the SDK only sends this config **once**, right after the
first `DATABRICKS_EMBED_READY` message. Technique 2 reloads the iframe on every
filter change, and a reloaded embed comes back with the footer visible again. So
before each reload we arm a one-shot listener that waits for the next
`DATABRICKS_EMBED_READY` and re-posts `DATABRICKS_SET_CONFIG` ourselves:

```85:99:frontend/src/pages/CustomDashboard.tsx
  const reapplyConfigOnNextReady = () => {
    const onReady = (e: MessageEvent) => {
      if (!fromEmbed(e)) return;
      if (e.data?.type === "DATABRICKS_EMBED_READY") {
        const iframe = containerRef.current?.querySelector("iframe");
        iframe?.contentWindow?.postMessage(
          { type: "DATABRICKS_SET_CONFIG", config: LOGO_CONFIG },
          instanceUrl
        );
        window.removeEventListener("message", onReady);
      }
    };
    window.addEventListener("message", onReady);
    setTimeout(() => window.removeEventListener("message", onReady), 20000);
  };
```

`LOGO_CONFIG` (line 10) mirrors what the SDK sends:
`{ version: 1, hideRefreshButton: false, hideDatabricksLogo: true }`. Every
`postMessage` is origin-checked via `fromEmbed` (lines 75–81) so we never trust an
unexpected origin.

---

## Technique 2 — Push host-app filters into the dashboard

The SDK has **no filter API**, so to apply the host FilterBar's selections we
rebuild the embed iframe's `src` with the documented **`f_` URL params** and let
the embed SPA reload with them.

### The `f_` grammar

```
f_{pageId}~{widgetId}={value}
```

- **`pageId`** — the page owning the filter widget. For cross-page filters this is
  the dashboard's **Global Filters page id** (`DashboardSpec.globalFilterPage`).
- **`widgetId`** — the filter widget's parameter key (e.g. `period`, `tsector`),
  from the `DashboardSpec.filters` map.
- **`value`** — URL-encoded. Date ranges are `encode(from+T…)~encode(to+T…)` — the
  `~` between `from` and `to` stays **literal**, only each side is encoded.

Examples:

```
f_54194f59~tsector=Air
f_54194f59~period=2025-01-01T00%3A00%3A00.000~2025-12-31T00%3A00%3A00.000
```

`serializeFilter` (config.ts lines 198–208) produces one `f_…=` param;
`buildFilterParams` (lines 210–218) walks only the dashboard's supported keys.
The IDs are config-driven — no hardcoded constants — via the `DASHBOARDS` registry
and `FILTERS` catalog:

```172:183:frontend/src/config.ts
export const DASHBOARDS: Record<string, DashboardSpec> = {
  apex: {
    id: "01f1271698161d42b3c66528415775e8",
    globalFilterPage: "54194f59",
    filters: {
      currentPeriod: "period",
      previousPeriod: "previous_period",
      travelSector: "tsector",
      destinationRegion: "dest_region",
    },
  },
};
```

To find these for a real dashboard: open it with basic embedding, apply a filter,
and read the `f_…` params it writes to the URL (or read the dashboard's
draft/published JSON — the page `name` is the `pageId`, each widget's parameter key
is the `widgetId`).

### Rebuild the URL on filter change

A filter change reloads the current page's iframe with fresh `f_…` params.
`reloadWithFilters` arms the hide-logo re-push (technique 1) **first**, then sets
`iframe.src`:

```101:106:frontend/src/pages/CustomDashboard.tsx
  const reloadWithFilters = (pageId: string, f: FilterState) => {
    const iframe = containerRef.current?.querySelector("iframe");
    if (!iframe || !tokenRef.current) return;
    reapplyConfigOnNextReady();
    iframe.src = buildTokenEmbedUrl(spec, pageId, tokenRef.current, f);
  };
```

Driven by an effect on the host `filters` object (lines 181–185).
`buildTokenEmbedUrl` produces the same `/embed/` URL basic embedding uses (so the
`f_…` params apply) with the scoped token in the `#token=` **hash** — keeping the
token out of the query string and server logs:

```228:247:frontend/src/config.ts
export function buildPageEmbedUrl(spec: DashboardSpec, pageId: string, filters?: FilterState): string {
  let url = `${embedRoot(spec)}/pages/${pageId}?${embedOrgParam(spec)}`;
  if (filters) url += `&${buildFilterParams(spec, filters)}`;
  return url;
}

export function buildTokenEmbedUrl(
  spec: DashboardSpec,
  pageId: string,
  token: string,
  filters?: FilterState
): string {
  return `${buildPageEmbedUrl(spec, pageId, filters)}#token=${token}`;
}
```

Resulting URL:

```
https://<workspace>/embed/dashboardsv3/{id}/pages/{page}?o={org}&f_54194f59~period=…~…&f_54194f59~tsector=Air#token=<scopedToken>
```

> **Page switches ≠ filter changes.** Changing pages without changing filters uses
> the SDK's smooth in-place `dash.navigate()` (no reload, no flash); it falls back
> to a filtered reload only if `navigate()` isn't ready (lines 171–178). Only
> filter changes rebuild the iframe.

---

## Technique 3 — Hide the dashboard's page header

The embed renders its own page header/title bar. We hide it with a purely
**cosmetic CSS crop** of the SDK's iframe: shift it up by `48px` and grow its
height by the same amount. Applied via `requestAnimationFrame` after
`initialize()` (see technique 1, line 154):

```15:24:frontend/src/pages/CustomDashboard.tsx
const HEADER_OFFSET = 48;

function cropIframeHeader(iframe: HTMLIFrameElement | null | undefined) {
  if (!iframe) return;
  iframe.style.display = "block";
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.marginTop = `-${HEADER_OFFSET}px`;
  iframe.style.height = `calc(100% + ${HEADER_OFFSET}px)`;
}
```

This only hides chrome — drop it if you want the embed's default header.

---

## Technique 4 — Hide the native filter pane by default

We want the **host app's FilterBar** (`frontend/src/components/FilterBar.tsx`) to
be the only filter UI. This isn't a runtime toggle — it's a **dashboard authoring
convention**:

- Every cross-page filter widget is placed on a dedicated **"Global Filters" page**
  (`globalFilterPage: "54194f59"`), not on the content pages.
- The app only ever embeds **content pages** — the `pages` list for each route
  (`frontend/src/config.ts` → `ROUTES`, e.g. `summary`, `carbon_forecasting`)
  **never includes `globalFilterPage`**. So the native filter widgets are never
  rendered in the iframe.
- The host FilterBar drives those off-screen widgets through the
  `f_54194f59~{widgetId}=…` params from technique 2. `getSupportedFilterKeys`
  (config.ts lines 189–192) decides which FilterBar controls show, keyed off the
  same `DashboardSpec.filters` map.

Net effect: the viewer sees only the app's FilterBar; the dashboard's own filter
pane is present in the dashboard model but never on screen.

---

## Adapting this to another dashboard

1. **Find the ids.** Get the `globalFilterPage` id and each filter's `widgetId`
   (basic-embedding URL or the dashboard JSON — see technique 2).
2. **Register it.** Add an entry to `DASHBOARDS` in `frontend/src/config.ts` with
   `id`, `globalFilterPage`, and a `filters` map (only the keys you list are pushed
   to the URL and shown in the FilterBar). Add a `RouteConfig` in `ROUTES` with
   `mode: "custom"` and its content `pages` (never the global filter page). If you
   need a filter that doesn't exist yet, add it to the `FILTERS` catalog and the
   `FilterKey` / `FilterState` types first.
3. **Grant access.** Give the SP (app SP and every tenant SP) `CAN_RUN` on the new
   dashboard, `CAN_USE` on the warehouse, and `SELECT` on the data. Add your app's
   origin to the dashboard's embedding allow-list.

Everything else is automatic: filter changes reload with `f_…` params, the
hide-logo config re-pushes, page switches use `navigate()`, and the token
auto-refreshes via the SDK's `getNewToken`.

---

## Caveats

- **No SDK filter API (yet).** `@databricks/aibi-client` can't push filter values
  from the host — that's the whole reason for the `f_` reload workaround. Prefer a
  first-class SDK filter API if/when it ships, and drop the reload.
- **The `f_` grammar is documented for *basic* embedding**, not the SDK/token path
  — but the iframe loads the same embed SPA, which honors the params regardless of
  auth mode, so it's stable in practice.
- **Removing login ≠ removing authorization.** Queries run as the SP, so it still
  needs warehouse + UC `SELECT`, and the UC row filter governs what each tenant's
  token can read. The `f_…` filters are a UI convenience, not a security boundary.

---

## File map

| Concern | File |
| --- | --- |
| 3-step token mint + per-tenant SP resolution + `/embed/token` route | `server/routes/embed.py` |
| Workspace host, default dashboard id, SP env contract | `server/config.py` |
| `f_` grammar, `DASHBOARDS` registry, `FILTERS` catalog, URL builders | `frontend/src/config.ts` |
| SDK render + all four techniques | `frontend/src/pages/CustomDashboard.tsx` |
| Host-app filter UI | `frontend/src/components/FilterBar.tsx` |
| Multi-tenant per-SP isolation (data scoping) | [`../handoff/multi-tenant-isolation.md`](../handoff/multi-tenant-isolation.md) |
