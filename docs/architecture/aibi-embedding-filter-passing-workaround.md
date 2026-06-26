# Passing Filters / URL Params Through Token-Based External Embedding of AI/BI Dashboards

> A self-contained, reproducible engineering guide for embedding a **Databricks
> AI/BI dashboard** in an **external app** (an app *not* hosted on Databricks —
> any Node/React/etc. front end with any backend) so that it renders with **no
> Databricks login** *and* with **filter values driven by the host app**.
>
> This documents the workaround we proved empirically for combining
> **token-based external embedding** with the **`f_…` filter URL grammar** that
> the `@databricks/aibi-client` SDK does not (yet) expose.

---

## 1. TL;DR — the override in one paragraph

The AI/BI external-embedding SDK (`@databricks/aibi-client`) does **not** (yet)
expose a way to pass dashboard filter values / parameters from the host app —
that capability is on the Databricks roadmap (internal idea
[DB-I-14988](https://databrickinternal.ideas.aha.io/ideas/DB-I-14988)). What the
SDK *does* do is mint/refresh a scoped token and build a standard
`/embed/dashboardsv3/{id}/...#token=<jwt>` iframe URL, talking to the iframe over
`postMessage`. Separately, **basic embedding** (session-cookie auth) has always
supported filter values via `f_…` URL query params. The key thing we proved
empirically: **token-based external embedding still honors the `f_…` URL params**
— because the SPA loaded inside the iframe is the *same one* basic embedding
uses. So the "override" is simply: **keep the SDK's token-auth model, but
construct the iframe URL ourselves** as
`/embed/dashboardsv3/{id}/pages/{page}?o=…&f_…=…#token=<scopedToken>` and load it
in our own iframe — instead of letting the SDK build the iframe. You can fork the
SDK shim to append the params, or skip the SDK entirely and render the ~15-line
iframe yourself (we did the latter). The result: **no-login white-label + app-
driven filters, together, today.**

---

## 2. Why this matters for an external app

A white-label / OEM analytics experience needs two things that basic embedding
alone cannot give an external (non-Databricks-hosted) app:

1. **No Databricks login screen.** Basic embedding authenticates with a
   Databricks **browser session cookie**; a user with no Databricks session is
   bounced to a login card. **Token-based external embedding** swaps that for a
   short-lived, **Service-Principal-scoped token** in the URL `#token=` hash, so
   the dashboard renders for anonymous / federated users.
2. **Host-app control of filters per user.** The host app decides what each
   viewer sees (period, sector, region, tenant) and passes those as `f_…` URL
   params. Combined with `external_value` for Unity Catalog row-level security,
   this is what makes the embed feel native and multi-tenant-safe.

This document shows how to get **both at once**.

---

## 3. The `f_` filter URL grammar

Filters are passed as URL query params on the standard `/embed/` URL. The grammar
(documented for [basic embedding](https://docs.databricks.com/aws/en/dashboards/share/embedding/basic-embed)
and empirically confirmed to survive token embedding):

```
f_{pageId}~{widgetId}={value}
```

- **`pageId`** — the dashboard page that owns the filter widget. For
  cross-page/global filters this is the dashboard's **Global Filters page id**.
- **`widgetId`** — the filter widget's id (the *parameter*/field key configured on
  the widget, e.g. `tsector`, `dest_region`, `period`).
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

### 3.3 Where the IDs come from

In our dashboard the global filter page id is `54194f59`, and the four widget ids
are `period`, `previous_period`, `tsector`, `dest_region`. These are defined once
in config and reused by every URL builder:

```30:37:app-appkit/apex/client/src/config.ts
// Global Filters page + widget IDs on the published dashboard.
const GLOBAL_PAGE = '54194f59';
const FILTER_WIDGETS = {
  period: 'period',
  previousPeriod: 'previous_period',
  travelSector: 'tsector',
  destinationRegion: 'dest_region',
};
```

You find the `pageId` / `widgetId` for a real dashboard by opening it with basic
embedding, applying a filter in the UI, and reading the `f_…` params it puts in
the URL — or from the dashboard's draft/published JSON (the page `name` and the
filter widget's parameter key).

### 3.4 The exact builder we use

`buildFilterParams` produces the two date-range params unconditionally and the two
field params only when set:

```39:54:app-appkit/apex/client/src/config.ts
function buildFilterParams(filters: FilterState): string {
  const params: string[] = [];
  params.push(
    `f_${GLOBAL_PAGE}~${FILTER_WIDGETS.period}=${encodeURIComponent(filters.currentPeriodFrom + 'T00:00:00.000')}~${encodeURIComponent(filters.currentPeriodTo + 'T00:00:00.000')}`,
  );
  params.push(
    `f_${GLOBAL_PAGE}~${FILTER_WIDGETS.previousPeriod}=${encodeURIComponent(filters.previousPeriodFrom + 'T00:00:00.000')}~${encodeURIComponent(filters.previousPeriodTo + 'T00:00:00.000')}`,
  );
  if (filters.travelSector) {
    params.push(`f_${GLOBAL_PAGE}~${FILTER_WIDGETS.travelSector}=${encodeURIComponent(filters.travelSector)}`);
  }
  if (filters.destinationRegion) {
    params.push(`f_${GLOBAL_PAGE}~${FILTER_WIDGETS.destinationRegion}=${encodeURIComponent(filters.destinationRegion)}`);
  }
  return params.join('&');
}
```

> Note the **date side is `encodeURIComponent`-d but the `~` separator between
> `from` and `to` is left literal** — the value is
> `encode(from+T...)~encode(to+T...)`, not `encode(from~to)`.

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
&authorization_details={JSON.stringify(tokenInfo.authorization_details)}
```
→ returns `{ "access_token": "<scopedToken>", "expires_in": 3600 }`.

`<scopedToken>` is what goes in the iframe URL's `#token=` hash. It is
**short-lived** (≈1 hour) and **scoped to exactly this one dashboard + viewer**.

### 4.3 Real TypeScript implementation

```62:109:app-appkit/apex/server/routes/apex/embed.ts
async function mintEmbedToken(
  dashboardId: string,
  viewerId: string,
  externalValue: string | null,
): Promise<{ token: string; expires_in: number }> {
  const instance = host();
  const { id, secret } = spCredentials();
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');

  // 1) broadly-scoped all-apis token for the SP
  const r1 = await postForm(`${instance}/oidc/v1/token`, basic, {
    grant_type: 'client_credentials',
    scope: 'all-apis',
  });
  if (!r1.ok) throw new Error(`step1 token failed: ${r1.status} ${await r1.text()}`);
  const oidcToken = ((await r1.json()) as { access_token: string }).access_token;

  // 2) tokeninfo scoped to the published dashboard + viewer
  const qp = new URLSearchParams({ external_viewer_id: viewerId });
  if (externalValue) qp.set('external_value', externalValue);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let tokenInfo: Record<string, unknown>;
  try {
    const r2 = await fetch(
      `${instance}/api/2.0/lakeview/dashboards/${dashboardId}/published/tokeninfo?${qp.toString()}`,
      { headers: { Authorization: `Bearer ${oidcToken}` }, signal: ctrl.signal },
    );
    if (!r2.ok) throw new Error(`step2 tokeninfo failed: ${r2.status} ${await r2.text()}`);
    tokenInfo = (await r2.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(t);
  }

  // 3) re-issue as a tightly-scoped, browser-safe token
  const body: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokenInfo)) {
    if (k === 'authorization_details') continue;
    body[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  body.grant_type = 'client_credentials';
  body.authorization_details = JSON.stringify(tokenInfo.authorization_details ?? []);

  const r3 = await postForm(`${instance}/oidc/v1/token`, basic, body);
  if (!r3.ok) throw new Error(`step3 token failed: ${r3.status} ${await r3.text()}`);
  const payload = (await r3.json()) as { access_token: string; expires_in?: number };
  return { token: payload.access_token, expires_in: Number(payload.expires_in ?? 3600) };
}
```

The SP credentials are read from the environment server-side only:

```30:37:app-appkit/apex/server/routes/apex/embed.ts
function spCredentials(): { id: string; secret: string } {
  const id = process.env.DATABRICKS_CLIENT_ID || process.env.EMBED_SP_CLIENT_ID;
  const secret = process.env.DATABRICKS_CLIENT_SECRET || process.env.EMBED_SP_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('No SP credentials (DATABRICKS_CLIENT_ID / DATABRICKS_CLIENT_SECRET) for embed-token minting');
  }
  return { id, secret };
}
```

### 4.4 Real Python implementation

The original Python route does the identical 3-step exchange:

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

### 4.5 Route surface

Both implementations expose the same HTTP contract — `GET /api/embed/token` (TS)
/ `GET /embed/token` (Python) with `dashboard_id`, `viewer_id`, and optional
`external_value`, returning `{ ok, dashboard_id, token, expires_in }`. The TS
route derives `viewer_id` / `external_value` from the edge identity when not
passed explicitly:

```111:131:app-appkit/apex/server/routes/apex/embed.ts
export function registerEmbedRoutes(appkit: AppKitLakebase) {
  appkit.server.extend((app) => {
    app.get('/api/embed/token', async (req, res) => {
      const dashboardId = (req.query.dashboard_id as string) || defaultDashboardId();
      if (!dashboardId) {
        res.status(400).json({ ok: false, error: 'dashboard_id is required' });
        return;
      }
      const identity = resolveIdentity(req);
      const viewerId = (req.query.viewer_id as string) || identity.userId;
      const externalValue = (req.query.external_value as string) || identity.externalValue;
      try {
        const result = await mintEmbedToken(dashboardId, viewerId, externalValue);
        res.json({ ok: true, dashboard_id: dashboardId, ...result });
      } catch (err) {
        console.error('[apex] embed token mint failed:', err);
        res.status(502).json({ ok: false, error: (err as Error).message });
      }
    });
  });
}
```


---

## 5. Client: building the URL + iframe + refresh

### 5.1 Build the URL (filters + `#token=`)

`buildPageEmbedUrl` produces the standard basic-embedding URL with `f_…` params;
`buildTokenEmbedUrl` appends the scoped token in the `#token=` hash. **This is the
override** — the same `/embed/` URL basic embedding uses, so the `f_…` params
still apply, but token-authenticated instead of cookie-authenticated:

```56:75:app-appkit/apex/client/src/config.ts
export function buildPageEmbedUrl(dashboardId: string, pageId: string, filters?: FilterState): string {
  let url = `${WORKSPACE}/embed/dashboardsv3/${dashboardId}/pages/${pageId}?o=${ORG}`;
  if (filters) url += `&${buildFilterParams(filters)}`;
  return url;
}

/**
 * External (token) embedding: the same /embed/ URL as basic embedding — so the
 * `f_…` filter params still apply — with a scoped SP token in the `#token=` hash
 * instead of a Databricks session cookie. This removes the Databricks login
 * screen for white-label viewers while keeping app-driven filters.
 */
export function buildTokenEmbedUrl(
  dashboardId: string,
  pageId: string,
  token: string,
  filters?: FilterState,
): string {
  return `${buildPageEmbedUrl(dashboardId, pageId, filters)}#token=${token}`;
}
```

The final URL looks like:

```
https://<workspace>/embed/dashboardsv3/{dashboardId}/pages/{pageId}?o={org}&f_54194f59~period=...~...&f_54194f59~tsector=Air#token=<scopedToken>
```

> Putting the token in the **hash fragment** (`#token=`) keeps it out of the query
> string (so it is not logged by servers/proxies the way query params are) while
> still being readable by the embed SPA in the browser.

### 5.2 Render the iframe + auto-refresh the token

The client fetches a token, refreshes it before expiry, and rebuilds the iframe
`src` whenever the token or filters change. Changing filters changes the URL,
which reloads the iframe (the documented way to re-apply filters from the host).

```31:62:frontend/src/pages/CustomDashboard.tsx
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchEmbedToken(dashboardId);
        if (cancelled) return;
        if (res.ok && res.token) {
          setToken(res.token);
          setTokenError(null);
          const ms = Math.max(60_000, (res.expires_in ?? 3600) * 1000 - 300_000);
          refreshRef.current = window.setTimeout(load, ms);
        } else {
          setTokenError(res.error || "Could not mint embed token");
        }
      } catch (e) {
        if (!cancelled) setTokenError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    return () => {
      cancelled = true;
      if (refreshRef.current) window.clearTimeout(refreshRef.current);
    };
  }, [dashboardId]);

  // Rebuild URLs when filters or token change — iframe src change triggers reload
  const pageUrls = useMemo(() => {
    if (!token) return {} as Record<string, string>;
    return Object.fromEntries(
      pages.map((page) => [page.pageId, buildTokenEmbedUrl(dashboardId, page.pageId, token, filters)])
    );
  }, [dashboardId, pages, filters, token]);
```

The refresh interval is `expires_in*1000 - 300_000` ms (refresh **5 minutes
before** expiry), floored at 60s. The iframe itself:

```133:143:frontend/src/pages/CustomDashboard.tsx
              <iframe
                src={src}
                title={`APEX — ${page.label}`}
                className="w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                onLoad={() => markLoaded(page.pageId)}
                style={{
                  marginTop: `-${HEADER_OFFSET}px`,
                  height: `calc(100% + ${HEADER_OFFSET}px)`,
                }}
              />
```

- **`sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`** — the
  minimum needed for the embed SPA to run, talk back to the workspace origin,
  drive its own filter widgets, and open popups (e.g. exports).
- **`marginTop: -48px` + `height: calc(100% + 48px)`** — a purely **cosmetic**
  crop that hides the embed's own header bar. Optional; drop it if you want the
  default chrome.

> The AppKit variant (`app-appkit/apex/client/src/components/CustomDashboard.tsx`)
> is the same pattern with per-user filter personalization layered on (load/save
> defaults from Lakebase), and it remounts the iframe via a `key` that includes a
> hash of the filters so a filter change forces a clean reload.

---

## 6. End-to-end recipe for an EXTERNAL (non-Databricks-hosted) app

This is framework-agnostic — it works for any backend + any frontend.

### (a) Backend: mint the token (SP secret stays server-side)

1. Store the embedding **SP `client_id` + `client_secret`** in server-side
   secrets (env var / secret manager). **Never** ship them to the browser.
2. Expose one route, e.g. `GET /api/embed/token?dashboard_id=…&viewer_id=…[&external_value=…]`.
3. In that route do the **3-step OAuth exchange** from §4:
   - `POST {host}/oidc/v1/token` with `grant_type=client_credentials&scope=all-apis` (Basic auth = `base64(id:secret)`).
   - `GET {host}/api/2.0/lakeview/dashboards/{id}/published/tokeninfo?external_viewer_id=…[&external_value=…]` (Bearer = step-1 token).
   - `POST {host}/oidc/v1/token` echoing the tokeninfo fields, `grant_type=client_credentials`, **`authorization_details` JSON-stringified** (Basic auth again).
4. Return `{ token, expires_in }` to the browser (just the final scoped token).
5. Derive `viewer_id` / `external_value` from *your own* authenticated session —
   not from anything the browser can spoof.

### (b) Frontend: fetch token, build URL with `f_` params, render, refresh

1. `fetch('/api/embed/token?dashboard_id=…')` → get `{ token, expires_in }`.
2. Build the URL yourself:
   `${WORKSPACE}/embed/dashboardsv3/{id}/pages/{page}?o={org}&{f_…params}#token={token}`
   using the `f_{pageId}~{widgetId}=value` grammar from §3.
3. Render an `<iframe src={url}>` with
   `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`.
4. **Refresh before expiry:** re-fetch the token at `expires_in - ~300s` and
   rebuild the `src`.
5. **Re-filter** by rebuilding the URL with new `f_…` params (this reloads the
   iframe). The dashboard's own in-frame filter widgets remain interactive too.

Minimal illustrative client (no SDK, no framework specifics):

```js
async function renderDashboard(container, { workspace, org, dashboardId, pageId, filters }) {
  const { token, expires_in } = await fetch(
    `/api/embed/token?dashboard_id=${encodeURIComponent(dashboardId)}`
  ).then((r) => r.json());

  const f = buildFilterParams(filters); // "f_<page>~<widget>=<value>&..."
  const url =
    `${workspace}/embed/dashboardsv3/${dashboardId}/pages/${pageId}` +
    `?o=${org}${f ? `&${f}` : ''}#token=${token}`;

  let iframe = container.querySelector('iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    container.appendChild(iframe);
  }
  iframe.src = url;

  // refresh ~5 min before expiry
  setTimeout(() => renderDashboard(container, { workspace, org, dashboardId, pageId, filters }),
    Math.max(60_000, (expires_in ?? 3600) * 1000 - 300_000));
}
```

### (c) Prerequisites / permissions (recap)

- Dashboard **published** with external embedding enabled (`embed_credentials = false`).
- Embedding **SP**: `CAN_RUN` on the published dashboard, `CAN_USE` on the
  warehouse, `SELECT` on the underlying UC tables/views.
- Add your external app's origin to the dashboard's **embedding allow-list**
  (approved domains) in the workspace.

### (d) Security notes

- The minted token is **short-lived** (~1h) and **scoped to one dashboard +
  one viewer** — safe to hand to the browser.
- The **SP secret never leaves the server.** Only the final scoped token is
  returned to the client.
- For **multi-tenant isolation**, pass `external_value` (e.g. the tenant/client
  id) and enforce it with **Unity Catalog row-level security** so each viewer's
  token can only read their own rows — defense in depth beyond the `f_…` filters
  (which are a UI convenience, not a security boundary).
- Authorize the token-minting route with *your* app's session; never let the
  browser choose its own `viewer_id` / `external_value`.

---

## 7. Caveats / what is NOT supported

- **No SDK filter API (yet).** `@databricks/aibi-client` does not expose a method
  to push filter values from the host app — that is on the roadmap
  ([DB-I-14988](https://databrickinternal.ideas.aha.io/ideas/DB-I-14988)). This
  workaround drives the iframe URL ourselves instead.
- **We rely on the basic-embedding `f_` grammar.** The `f_{page}~{widget}=value`
  syntax is the documented, supported public contract for *basic* embedding.
  Databricks does not (yet) document it for the SDK/token path — but the iframe
  loads the **same embed SPA**, which honors the params regardless of auth mode,
  so it is stable in practice. If/when the SDK ships a first-class filter API,
  prefer it.
- **Re-filtering after load means reloading the iframe.** Changing host-app
  filters rebuilds the `src` (a quick reload). The dashboard's own in-frame
  filter widgets remain fully interactive without a reload.
- **Data access still applies.** Removing the *login* does not remove
  *authorization* — the SP must have warehouse + UC `SELECT` (and RLS governs
  what each `external_value` can see).

---

## 8. File map (where this lives in this repo)

| Concern | Python (original) | TypeScript / AppKit (port) |
| --- | --- | --- |
| 3-step token minting | `server/routes/embed.py` | `app-appkit/apex/server/routes/apex/embed.ts` |
| `f_` grammar + URL builders | `frontend/src/config.ts` | `app-appkit/apex/client/src/config.ts` |
| iframe render + token refresh | `frontend/src/pages/CustomDashboard.tsx` | `app-appkit/apex/client/src/components/CustomDashboard.tsx` |

Related notes: `docs/architecture/poc-status-and-path-forward.md` (empirical
validation of filters surviving token embedding) and
`docs/architecture/appkit-whitelabel-prototype.md` (full white-label
architecture).

See also: [`external-hosting.md`](./external-hosting.md) — how to run this app
**outside Databricks** (EC2/ECS/any container) while reusing this exact
embedding + filter-passing pattern via a Service Principal.
