# White-Label AI/BI Dashboard Embedding + Host-App-Driven Filter Passing

> A self-contained, reproducible engineering guide for embedding a **Databricks
> AI/BI dashboard** in an app so that it renders with **no Databricks login**
> *and* with **filter values driven by the host app**.
>
> On this branch APEX uses the official **`@databricks/aibi-client`
> `DatabricksDashboard` SDK** for authentication, the hide-logo config, and smooth
> page navigation — then layers a small, documented **`f_…` URL-param reload**
> workaround on top for the one thing the SDK still cannot do: **push filter
> values from the host app.** This doc explains that hybrid precisely, grounded in
> the current code.

---

## 1. TL;DR — the hybrid approach in one paragraph

We use the official `@databricks/aibi-client` SDK (`DatabricksDashboard`) for
everything it supports: **token mint + auto-refresh** (via its `getNewToken`
callback), the supported **`config: { hideDatabricksLogo: true }`** flag that
removes the "Powered by Databricks" footer, and **smooth in-place page switches**
via `dash.navigate()`. The SDK has **no filter API**, so to push host-app filter
values we do the one thing the SDK does not: we **rebuild the embed iframe's
`src` ourselves** with the documented `f_{pageId}~{widgetId}=value` URL params
(`reloadWithFilters` → `buildTokenEmbedUrl`). Because the SDK only pushes the
hide-logo config **once** (right after the first `DATABRICKS_EMBED_READY`
`postMessage`), every time we reload the iframe for a filter change we must
**re-push `DATABRICKS_SET_CONFIG` with our `LOGO_CONFIG`** ourselves — otherwise
the Databricks footer reappears. That re-push is the non-obvious trick
(`reapplyConfigOnNextReady`). Finally, the embed's own page header is hidden with
a purely **cosmetic CSS crop** (`cropIframeHeader`, `marginTop: -48px`) applied to
the SDK-generated iframe. The result: **no-login white-label + app-driven
filters, together, today** — using the supported SDK where it works and a thin
URL workaround only where it doesn't.

---

## 2. Why this matters for a white-label app

A white-label / OEM analytics experience needs two things that basic embedding
alone cannot give a host app:

1. **No Databricks login screen.** Basic embedding authenticates with a
   Databricks **browser session cookie**; a user with no Databricks session is
   bounced to a login card. **Token-based external embedding** swaps that for a
   short-lived, **Service-Principal-scoped token** (the SDK puts it in the iframe
   URL `#token=` hash), so the dashboard renders for anonymous / federated users.
2. **Host-app control of filters per user.** The host app decides what each
   viewer sees (period, sector, region, tenant) and passes those as `f_…` URL
   params. Combined with `external_value` for Unity Catalog row-level security,
   this is what makes the embed feel native and multi-tenant-safe.

This document shows how to get **both at once** — the SDK gives us #1 cleanly;
the `f_…` reload workaround gives us #2.

---

## 3. The `f_` filter URL grammar

Filters are passed as URL query params on the standard `/embed/` URL. The grammar
(documented for [basic embedding](https://docs.databricks.com/aws/en/dashboards/share/embedding/basic-embed)
and empirically confirmed to survive token embedding — the iframe loads the same
embed SPA regardless of auth mode):

```
f_{pageId}~{widgetId}={value}
```

- **`pageId`** — the dashboard page that owns the filter widget. For
  cross-page/global filters this is the dashboard's **Global Filters page id**.
  In this app it comes from `DashboardSpec.globalFilterPage`.
- **`widgetId`** — the filter widget's id (the *parameter*/field key configured on
  the widget, e.g. `tsector`, `dest_region`, `period`). It comes from the
  `DashboardSpec.filters` map (logical `FilterKey` → widget id).
- **`value`** — the selected value, **URL-encoded**.

### 3.1 Single-select / field filters

```
f_54194f59~tsector=Air
f_54194f59~dest_region=Europe
```

### 3.2 Date-range filters

A date-range filter takes a `from~to` value, and each side is encoded with a
`T00:00:00.000` time suffix (then URL-encoded — the `:` becomes `%3A`):

```
f_54194f59~period=2025-01-01T00%3A00%3A00.000~2025-12-31T00%3A00%3A00.000
```

> Note the **date side is `encodeURIComponent`-d but the `~` separator between
> `from` and `to` is left literal** — the value is
> `encode(from+T...)~encode(to+T...)`, not `encode(from~to)`.

### 3.3 Where the IDs come from (config-driven registry)

On this branch there are **no** hardcoded `GLOBAL_PAGE` / `FILTER_WIDGETS`
constants. Instead every dashboard is registered declaratively in the `DASHBOARDS`
registry: each entry carries its own `globalFilterPage` (the Global Filters page
id) and a `filters` map that binds each logical `FilterKey` to the **widget id**
that drives it on that specific dashboard. Only the keys listed here are pushed
into the embed URL (and shown in the FilterBar), so different dashboards can
expose different filter sets:

```170:190:frontend/src/config.ts
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

export function getDashboardById(id: string): DashboardSpec | undefined {
  return Object.values(DASHBOARDS).find((d) => d.id === id);
}

export function getSupportedFilterKeys(spec?: DashboardSpec): FilterKey[] {
  if (!spec) return [];
  return (Object.keys(spec.filters) as FilterKey[]).filter((k) => !!spec.filters[k]);
}
```

The `DashboardSpec` shape (note the optional per-dashboard `workspace` / `org`
overrides — a dashboard can live in a different workspace/org than the global
defaults):

```162:168:frontend/src/config.ts
export interface DashboardSpec {
  id: string;                                   // Lakeview dashboard id
  globalFilterPage: string;                     // "Global Filters" page id
  filters: Partial<Record<FilterKey, string>>;  // FilterKey → widget id
  workspace?: string;                           // optional per-dashboard workspace
  org?: string;                                 // optional per-dashboard org id
}
```

The **logical filters** themselves (how they render and which `FilterState`
fields they map to) are declared once in the `FILTERS` catalog. A dashboard's
`filters` map binds these keys to its own widget ids:

```106:153:frontend/src/config.ts
export const FILTERS: Record<FilterKey, FilterDef> = {
  currentPeriod: {
    key: "currentPeriod",
    kind: "dateRange",
    label: "Period",
    fromField: "currentPeriodFrom",
    toField: "currentPeriodTo",
  },
  previousPeriod: {
    key: "previousPeriod",
    kind: "dateRange",
    label: "vs",
    fromField: "previousPeriodFrom",
    toField: "previousPeriodTo",
  },
  travelSector: {
    key: "travelSector",
    kind: "field",
    label: "Sector",
    field: "travelSector",
    allLabel: "All Sectors",
    options: [
      "Domestic",
      "Regional",
      "Intra Country",
      "Intra Continental",
      "Inter Continental",
      "Intercontinental",
    ],
  },
  destinationRegion: {
    key: "destinationRegion",
    kind: "field",
    label: "Region",
    field: "destinationRegion",
    allLabel: "All Regions",
    options: [
      "Africa",
      "Asia",
      "Europe",
      "Latin America",
      "Middle East",
      "North America",
      "Southwestern Pacific",
      "Unknown",
    ],
  },
};
```

You find the `pageId` / `widgetId` for a real dashboard by opening it with basic
embedding, applying a filter in the UI, and reading the `f_…` params it puts in
the URL — or from the dashboard's draft/published JSON (the page `name` and the
filter widget's parameter key).

### 3.4 The exact builders we use

`serializeFilter` turns one logical filter into one `f_…=` param (date ranges get
the `from~to` `T00:00:00.000` encoding; field filters are emitted only when set):

```196:206:frontend/src/config.ts
function serializeFilter(page: string, def: FilterDef, widget: string, f: FilterState): string | null {
  if (def.kind === "dateRange") {
    const from = f[def.fromField] as string | undefined;
    const to = f[def.toField] as string | undefined;
    if (!from || !to) return null;
    return `f_${page}~${widget}=${encodeURIComponent(from + "T00:00:00.000")}~${encodeURIComponent(to + "T00:00:00.000")}`;
  }
  const value = f[def.field] as string | undefined;
  if (!value) return null;
  return `f_${page}~${widget}=${encodeURIComponent(value)}`;
}
```

`buildFilterParams` walks only the dashboard's supported filter keys, resolving
each key's widget id from `spec.filters` and its page from `spec.globalFilterPage`:

```208:216:frontend/src/config.ts
function buildFilterParams(spec: DashboardSpec, filters: FilterState): string {
  const params: string[] = [];
  for (const key of getSupportedFilterKeys(spec)) {
    const widget = spec.filters[key]!;
    const part = serializeFilter(spec.globalFilterPage, FILTERS[key], widget, filters);
    if (part) params.push(part);
  }
  return params.join("&");
}
```

---

## 4. Server: minting the scoped embed token (3-step OAuth)

The token is minted **server-side** with the app/embedding **Service Principal's**
client id + secret. The browser never sees the SP secret — it only receives the
final short-lived, dashboard-scoped token.

### 4.1 Prerequisites

- An **app / embedding Service Principal** with an OAuth **client id + secret**.
- The dashboard must be **published with embedding enabled** for external
  viewers (`embed_credentials = false`, i.e. it runs queries *as the SP*, not as
  the publisher).
- The SP needs **`CAN_RUN` on the published dashboard**.
- Because queries run as the SP, the SP needs **access to the underlying data**:
  `CAN_USE` on the SQL **warehouse** and `SELECT` on the **Unity Catalog**
  tables/views (subject to any **row-level security / RLS**).
- `external_viewer_id` and (optional) `external_value` enable **per-viewer
  scoping**: `external_value` is the value Unity Catalog RLS policies key on for
  per-tenant data isolation.

### 4.2 Language-agnostic flow

Let `host = https://<your-workspace-host>` and `basic = base64(client_id:client_secret)`.

**Step 1 — SP client-credentials → broadly-scoped `all-apis` token**

```
POST {host}/oidc/v1/token
Authorization: Basic {basic}
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=all-apis
```
→ returns `{ "access_token": "<oidcToken>" }`.

**Step 2 — get tokeninfo scoped to this published dashboard + viewer**

```
GET {host}/api/2.0/lakeview/dashboards/{dashboardId}/published/tokeninfo
      ?external_viewer_id={viewerId}&external_value={externalValue}
Authorization: Bearer {oidcToken}
```
→ returns a JSON `tokenInfo` object that includes an `authorization_details`
field (an array) plus other scope fields. (`external_value` is optional; include
it only when using RLS.)

**Step 3 — re-issue tokeninfo as a tightly-scoped, browser-safe token**

POST the `tokenInfo` fields back to the token endpoint, with
`grant_type=client_credentials`, and crucially **`authorization_details`
JSON-stringified**:

```
POST {host}/oidc/v1/token
Authorization: Basic {basic}
Content-Type: application/x-www-form-urlencoded

{...tokenInfo fields...}
&grant_type=client_credentials
&authorization_details={json.dumps(tokenInfo.authorization_details)}
```
→ returns `{ "access_token": "<scopedToken>", "expires_in": 3600 }`.

`<scopedToken>` is what goes in the iframe URL's `#token=` hash. It is
**short-lived** (≈1 hour) and **scoped to exactly this one dashboard + viewer**.

### 4.3 Real implementation (`server/routes/embed.py`)

The SP credentials are read from the environment server-side only. Note the env
var contract: **`DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET`** (the
standard SDK / Databricks Apps names), with **`EMBED_SP_CLIENT_ID` /
`EMBED_SP_CLIENT_SECRET`** accepted as fallbacks. This matches `server/config.py`
and `.env.example` exactly.

```40:53:server/routes/embed.py
def _sp_credentials() -> tuple[str, str]:
    """The app Service Principal's OAuth client_id/secret.

    On Databricks Apps these are injected as DATABRICKS_CLIENT_ID /
    DATABRICKS_CLIENT_SECRET. Locally, set them in the environment (or .env).
    """
    cid = os.environ.get("DATABRICKS_CLIENT_ID") or os.environ.get("EMBED_SP_CLIENT_ID")
    csec = os.environ.get("DATABRICKS_CLIENT_SECRET") or os.environ.get("EMBED_SP_CLIENT_SECRET")
    if not cid or not csec:
        raise RuntimeError(
            "No SP credentials for embed-token minting "
            "(DATABRICKS_CLIENT_ID / DATABRICKS_CLIENT_SECRET not set)."
        )
    return cid, csec
```

The 3-step exchange itself:

```56:99:server/routes/embed.py
def _mint_embed_token(dashboard_id: str, viewer_id: str, external_value: str | None) -> dict:
    instance = WORKSPACE_URL.rstrip("/")
    cid, csec = _sp_credentials()
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

### 4.4 Route surface + session-derived viewer identity

The HTTP contract is `GET /embed/token` (mounted under `/api`, so the browser
calls `/api/embed/token`) with optional `dashboard_id`, `viewer_id`, and
`external_value`, returning `{ ok, dashboard_id, token, expires_in }`. Crucially,
`viewer_id` / `external_value` are **derived from the server-side session
identity** (`request.state.identity`, set by the auth middleware) — so each
tenant automatically gets row-scoped data and the browser cannot spoof its own
identity. Explicit query params still override:

```102:133:server/routes/embed.py
@router.get("/embed/token")
def embed_token(request: Request,
                dashboard_id: str | None = None,
                viewer_id: str = "apex-viewer",
                external_value: str | None = None) -> JSONResponse:
    """Return a scoped, browser-safe embed token for the given dashboard.

    When a white-label session is present (``request.state.identity``, set by the
    auth middleware), the logged-in tenant's ``external_value`` and a stable
    ``viewer_id`` derived from the session take precedence over the query-param
    defaults — so each tenant automatically gets row-scoped data without the
    caller having to pass anything. Explicit query params still override when set.
    """
    did = dashboard_id or _DEFAULT_DASHBOARD_ID

    identity = getattr(request.state, "identity", None)
    if identity:
        # Session identity wins over the default viewer; a query-param override
        # (anything other than the default) is still honored.
        if viewer_id == "apex-viewer":
            viewer_id = identity.get("email") or identity.get("tenant") or viewer_id
        if external_value is None:
            external_value = identity.get("external_value")

    try:
        result = _mint_embed_token(did, viewer_id, external_value)
        return JSONResponse({"ok": True, "dashboard_id": did, **result})
    except requests.HTTPError as e:
        body = e.response.text[:400] if e.response is not None else str(e)
        return JSONResponse({"ok": False, "error": f"token exchange failed: {body}"}, status_code=502)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
```

The default dashboard id is parsed from `DASHBOARD_URL`, and the workspace host
from `WORKSPACE_URL`, both sourced from `server/config.py`:

```25:45:server/config.py
WORKSPACE_URL = (
    _normalize_host(os.environ.get("DATABRICKS_HOST"))
    or _normalize_host(os.environ.get("workspace_url"))
    or "https://dbc-1e27e56a-90cd.cloud.databricks.com"
)

# Service Principal OAuth (M2M / client_credentials). When these are present the
# app authenticates to Databricks AS THE SP from anywhere — no Databricks Apps
# platform, no Databricks login. On Databricks Apps the platform injects these
# same two variables, so a single code path works in both environments.
DATABRICKS_CLIENT_ID = (
    os.environ.get("DATABRICKS_CLIENT_ID") or os.environ.get("EMBED_SP_CLIENT_ID")
)
DATABRICKS_CLIENT_SECRET = (
    os.environ.get("DATABRICKS_CLIENT_SECRET") or os.environ.get("EMBED_SP_CLIENT_SECRET")
)
HAS_SP_CREDENTIALS = bool(DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET)
DASHBOARD_URL = os.environ.get(
    "DASHBOARD_URL",
    "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1271698161d42b3c66528415775e8?o=1048934788948873",
)
```

> A TypeScript port of this same 3-step exchange also exists in the AppKit variant
> of this app (a different repo); it is functionally identical. There is no such
> file on this branch, so it is not linked here.

---

## 5. Client: the SDK-based render (the heart of this topic)

This is the biggest change from older versions of this doc. We **do not** hand-
render a raw iframe anymore. `frontend/src/pages/CustomDashboard.tsx` uses the
official `@databricks/aibi-client` `DatabricksDashboard` SDK, and layers the
`f_…` filter workaround on top. Five moving parts:

1. SDK creation + token mint/refresh + hide-logo config
2. Re-push the hide-logo config after every reload (the non-obvious trick)
3. Filter changes → rebuild the iframe `src` with `f_…` params
4. Page switches → the SDK's smooth `navigate()`
5. Cosmetic header crop + origin-checked `postMessage`

### 5.1 Create the SDK dashboard (auth, refresh, hide-logo, navigate)

The SDK is constructed once per dashboard. We pass the freshly minted token, a
`getNewToken` callback the SDK calls to refresh before expiry, and the supported
`config: { hideDatabricksLogo: true }` flag. `dash.initialize()` synchronously
appends the embed iframe into our container:

```126:168:frontend/src/pages/CustomDashboard.tsx
    (async () => {
      const res = await fetchEmbedToken(dashboardId);
      if (cancelled) return;
      if (!res.ok || !res.token) {
        setError(res.error || "Could not mint embed token");
        setPhase("error");
        return;
      }
      tokenRef.current = res.token;
      if (!containerRef.current) return;
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
    })();
```

Token refresh is entirely the SDK's job here: it calls our `getNewToken` callback,
which re-hits `/api/embed/token` and returns a fresh scoped token. We keep the
latest token in `tokenRef` so our own filter reloads (below) can reuse it.

### 5.2 The non-obvious trick: re-push the hide-logo config after every reload

The SDK only pushes the hide-logo config **once**, right after the first
`DATABRICKS_EMBED_READY` `postMessage` from the embed. But our filter mechanism
(§5.3) **reloads the iframe** by reassigning its `src` — and a reloaded embed
comes back with the Databricks footer visible again. So before every reload we
arm a one-shot listener that waits for the next `DATABRICKS_EMBED_READY` and
re-sends `DATABRICKS_SET_CONFIG` with our `LOGO_CONFIG` ourselves. This is the
subtlety that keeps the footer hidden across filter changes:

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

`LOGO_CONFIG` is our local mirror of what the SDK sends once (the listener is
also self-cleaning: it removes itself on match, and after a 20s safety timeout):

```10:10:frontend/src/pages/CustomDashboard.tsx
const LOGO_CONFIG = { version: 1, hideRefreshButton: false, hideDatabricksLogo: true };
```

### 5.3 Filter changes → rebuild the iframe `src` with `f_…` params

The SDK has **no filter API**, so applying host-app filters means rebuilding the
iframe `src` with `f_…` params — exactly the grammar from §3. `reloadWithFilters`
arms the config re-push (§5.2) **first**, then sets `iframe.src` to a freshly
built token embed URL:

```101:106:frontend/src/pages/CustomDashboard.tsx
  const reloadWithFilters = (pageId: string, f: FilterState) => {
    const iframe = containerRef.current?.querySelector("iframe");
    if (!iframe || !tokenRef.current) return;
    reapplyConfigOnNextReady();
    iframe.src = buildTokenEmbedUrl(spec, pageId, tokenRef.current, f);
  };
```

A React effect fires this whenever the host-app `filters` object changes (once the
embed is ready):

```181:185:frontend/src/pages/CustomDashboard.tsx
  useEffect(() => {
    if (!readyRef.current) return;
    reloadWithFilters(pageRef.current, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);
```

`buildTokenEmbedUrl` is the "override": it produces the *same* `/embed/` URL basic
embedding uses (so the `f_…` params apply), with the scoped SP token in the
`#token=` hash instead of a cookie:

```232:251:frontend/src/config.ts
export function buildPageEmbedUrl(spec: DashboardSpec, pageId: string, filters?: FilterState): string {
  let url = `${embedRoot(spec)}/pages/${pageId}?${embedOrgParam(spec)}`;
  if (filters) url += `&${buildFilterParams(spec, filters)}`;
  return url;
}

/**
 * External (token) embedding: same /embed/ URL as basic embedding (so the
 * `f_…` filter params still apply), but with a scoped SP token in the `#token=`
 * hash instead of relying on a Databricks session cookie. This is what removes
 * the Databricks login screen for no-login / white-label viewers.
 */
export function buildTokenEmbedUrl(
  spec: DashboardSpec,
  pageId: string,
  token: string,
  filters?: FilterState
): string {
  return `${buildPageEmbedUrl(spec, pageId, filters)}#token=${token}`;
}
```

The final URL looks like:

```
https://<workspace>/embed/dashboardsv3/{id}/pages/{page}?o={org}&f_54194f59~period=...~...&f_54194f59~tsector=Air#token=<scopedToken>
```

> Putting the token in the **hash fragment** (`#token=`) keeps it out of the query
> string (so it is not logged by servers/proxies the way query params are) while
> still being readable by the embed SPA in the browser.

Note also that initial non-default filters (e.g. restored per-user preferences)
are applied by calling `reloadWithFilters` the moment the embed first reports
ready:

```115:123:frontend/src/pages/CustomDashboard.tsx
    const onFirstReady = (e: MessageEvent) => {
      if (!fromEmbed(e)) return;
      if (e.data?.type === "DATABRICKS_EMBED_READY" && !readyRef.current) {
        readyRef.current = true;
        setPhase("ready");
        // Apply any non-default initial filters (e.g. restored from Lakebase).
        if (!filtersAreDefault(filters)) reloadWithFilters(pageRef.current, filters);
      }
    };
```

### 5.4 Page switches → the SDK's smooth `navigate()`

Switching pages **without** a filter change does not need an iframe reload — the
SDK can navigate in place, avoiding a flash. We fall back to a filtered reload
only if `navigate()` isn't available yet:

```171:178:frontend/src/pages/CustomDashboard.tsx
  useEffect(() => {
    if (!readyRef.current || !dashRef.current) return;
    dashRef.current.navigate({ dashboardId, pageId: currentPageId }).catch(() => {
      // Fall back to a reload if navigate isn't available yet.
      reloadWithFilters(currentPageId, filters);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageId]);
```

### 5.5 Cosmetic header crop + origin-checked postMessage

The embed renders its own page header/title bar at the top. We hide it with a
**purely cosmetic** CSS crop applied to the SDK-generated iframe: shift it up by
`48px` and over-size its height by the same amount. Because the SDK appends the
iframe itself, we (re)apply this via `cropIframeHeader`, guarded by
`requestAnimationFrame` (see §5.1 where it's called after `initialize()`):

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

> This is purely cosmetic — it only hides chrome. Drop it if you want the embed's
> default header.

Every `postMessage` event we act on is **origin-checked** against the embed's
workspace origin via `fromEmbed`, so we never trust messages from an unexpected
origin:

```75:81:frontend/src/pages/CustomDashboard.tsx
  const fromEmbed = (e: MessageEvent): boolean => {
    try {
      return new URL(e.origin).origin === new URL(instanceUrl).origin;
    } catch {
      return false;
    }
  };
```

---

## 6. Step-by-step: adapt this to YOUR dashboard

### (a) Find your `pageId` / `widgetId`s

1. Open your published dashboard with **basic embedding** in a browser (you have a
   Databricks session).
2. Apply each filter in the UI and read the `f_…` params the page writes into the
   URL: `f_{pageId}~{widgetId}=value`. The `pageId` for cross-page filters is the
   **Global Filters** page id; the `widgetId` is the filter widget's parameter key
   (e.g. `tsector`).
3. Alternatively, read the dashboard's draft/published JSON: the page `name`
   gives the `pageId`, and each filter widget's parameter key gives the `widgetId`.

### (b) Register the dashboard in the `DASHBOARDS` registry

Add an entry to `DASHBOARDS` in `frontend/src/config.ts` (§3.3). Set:

- `id` — the Lakeview dashboard id.
- `globalFilterPage` — the Global Filters page id from step (a).
- `filters` — map each logical `FilterKey` you want exposed to that dashboard's
  widget id. Only keys you list here are pushed into the URL and shown in the
  FilterBar, so omit filters this dashboard doesn't have.
- Optionally `workspace` / `org` if this dashboard lives in a different
  workspace/org than the global `WORKSPACE` / `ORG` defaults.

If you need a **new logical filter** that doesn't exist yet, add it to the
`FILTERS` catalog and to the `FilterKey` / `FilterState` types first, then bind it
in the dashboard's `filters` map.

### (c) Wire it into the app + server

1. Add a `RouteConfig` in `ROUTES` (`frontend/src/config.ts`) with
   `mode: "custom"`, `dashboard: "<your registry key>"`, and its `pages` (each
   with a `label` + `pageId`).
2. Ensure the server can mint a token for it: either it uses the default from
   `DASHBOARD_URL`, or the frontend passes `dashboard_id` to
   `/api/embed/token` (it always does — see `fetchEmbedToken`, which sends the
   `dashboard_id` query param).
3. Grant the **SP** `CAN_RUN` on the new dashboard and `SELECT` on its data
   (see §4.1 / §7).

### (d) Everything else is automatic

Filter changes reload the iframe with the new `f_…` params (§5.3), the hide-logo
config is re-pushed after each reload (§5.2), page switches use `navigate()`
(§5.4), and the token auto-refreshes via the SDK's `getNewToken` (§5.1).

---

## 7. Prerequisites / permissions (recap)

- Dashboard **published** with external embedding enabled (`embed_credentials = false`).
- Embedding **SP**: `CAN_RUN` on the published dashboard, `CAN_USE` on the
  warehouse, `SELECT` on the underlying UC tables/views.
- Add your app's origin to the dashboard's **embedding allow-list** (approved
  domains) in the workspace.
- Env contract (identical across `server/config.py`, `server/routes/embed.py`,
  and `.env.example`): `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`,
  `DATABRICKS_CLIENT_SECRET` (with `EMBED_SP_CLIENT_ID` / `EMBED_SP_CLIENT_SECRET`
  accepted as fallbacks), plus `DASHBOARD_URL` for the default dashboard id.

### Security notes

- The minted token is **short-lived** (~1h) and **scoped to one dashboard +
  one viewer** — safe to hand to the browser.
- The **SP secret never leaves the server.** Only the final scoped token is
  returned to the client.
- For **multi-tenant isolation**, pass `external_value` (e.g. the tenant/client
  id) and enforce it with **Unity Catalog row-level security** so each viewer's
  token can only read their own rows — defense in depth beyond the `f_…` filters
  (which are a UI convenience, not a security boundary).
- Authorize the token-minting route with *your* app's session; the server derives
  `viewer_id` / `external_value` from `request.state.identity`, never letting the
  browser pick its own.
- Client `postMessage` handlers are origin-checked against the embed's workspace
  origin (`fromEmbed`, §5.5).

---

## 8. Caveats / what is NOT supported

- **No SDK filter API (yet).** `@databricks/aibi-client` does not expose a method
  to push filter values from the host app — that is on the Databricks roadmap
  (internal idea
  [DB-I-14988](https://databrickinternal.ideas.aha.io/ideas/DB-I-14988)). This is
  the entire reason for the `f_…` URL-reload workaround; if/when the SDK ships a
  first-class filter API, prefer it and drop §5.2/§5.3.
- **We rely on the basic-embedding `f_` grammar.** The `f_{page}~{widget}=value`
  syntax is the documented, supported public contract for *basic* embedding.
  Databricks does not (yet) document it for the SDK/token path — but the iframe
  loads the **same embed SPA**, which honors the params regardless of auth mode,
  so it is stable in practice.
- **Re-filtering after load means reloading the iframe** (and therefore re-pushing
  the hide-logo config, §5.2). The dashboard's own in-frame filter widgets remain
  fully interactive without a host-driven reload. Page switches *without* a filter
  change avoid the reload entirely via `navigate()`.
- **Data access still applies.** Removing the *login* does not remove
  *authorization* — the SP must have warehouse + UC `SELECT` (and RLS governs
  what each `external_value` can see).

---

## 9. File map (where this lives in this repo)

| Concern | File |
| --- | --- |
| 3-step token minting + `/embed/token` route | `server/routes/embed.py` |
| Workspace host + default dashboard id + SP env | `server/config.py` |
| `f_` grammar, `DASHBOARDS` registry, `FILTERS` catalog, URL builders | `frontend/src/config.ts` |
| SDK render + hide-logo re-push + filter reload + navigate + header crop | `frontend/src/pages/CustomDashboard.tsx` |
| Env contract for external hosting | `.env.example` |

See also: [`external-hosting.md`](./external-hosting.md) — how to run this app
**outside Databricks** (EC2/ECS/any container) while reusing this exact
embedding + filter-passing pattern via a Service Principal.
