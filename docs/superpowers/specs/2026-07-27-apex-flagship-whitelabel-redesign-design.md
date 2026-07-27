# APEX Flagship White-Label Redesign — Design

**Date:** 2026-07-27
**Branch:** `feature/genie-mcp-app-view` (staged PRs per section)
**Status:** Approved design — ready for implementation planning

## Goal

Turn this repo into **the** reference implementation for building a white-label
analytics experience on Databricks (embedded dashboards + Genie). It already
proves the hard techniques (SP-per-tenant isolation, token embedding, Genie
MCP). This redesign makes it *flagship-quality*: easy to rebrand, with a clean
and intuitive admin experience, and a modern UI.

## Governing tenet — minimal · config-driven · agent-ready

Every decision below serves this, in priority order:

1. **Agent-ready** — an agent or human can answer *"where do I change X?"* in
   **one hop**, without reading the codebase. Editable source-of-truth lives as
   **files in the repo** (JSON/TS config), never as runtime database state an
   agent can't see or edit. Every knob file is named `*.config.*` or `*.seed.*`.
2. **Config-driven** — behavior and appearance come from declarative config, not
   scattered literals. One source per concern; one-hop indirection (config →
   effect, no tracing through five files).
3. **Minimal** — YAGNI. Favor the smallest change that demonstrates the pattern.

A **"Change X → edit Y" map** (see [§7](#7-agent-readiness-deliverables)) is a
first-class deliverable, added to `AGENTS.md` and `docs/`.

### Load-bearing invariants (must not break — from AGENTS.md)

- **Tenant join key:** white-label login `tenant_id` **is** the `tenant_id` in
  the tenant registry. No separate user→tenant table.
- **Per-tenant identity:** each tenant has its own SP; Genie MCP + AI/BI embed
  run **as that SP**; the UC row filter is the load-bearing isolation control.
  The resolver seam `resolve_tenant_sp(request) -> (token, TenantRow) | None`
  must **fall back to the app SP on `None` — never fail**.
- **Secrets:** SP client secrets stay AES-GCM encrypted at rest; shown once at
  onboard/rotate; never logged/committed.
- **Fail soft:** Lakebase and white-label auth degrade gracefully (in-memory /
  JSON + open access) when disabled. **This redesign must preserve fail-soft for
  every new persisted concern** (theming, asset registry).
- **Admin API/UI is operator-only** (`role == "operator"`).

## Delivery

Five staged, independently reviewable/revertable PRs, in order:

| PR | Section | Summary |
|----|---------|---------|
| 1 | [A](#section-a--theming-foundation) | Theming foundation: `brand.config.json` + ThemeProvider + semantic tokens |
| 2 | [B](#section-b--login-split-operator-vs-user) | Login: user/operator toggle, role-filtered demo chips |
| 3 | [C](#section-c--admin-information-architecture) | Admin IA: Manage Assets (registry + access grid) + Manage Users & SPs |
| 4 | [D](#section-d--sp-creation-onboarding-flow) | Guided SP onboarding (pick client → provision SP → create login user) |
| 5 | [E](#section-e--ui-polish--consistency) | UI polish & consistency pass |
| 6 | [F](#section-f--ask-apex-chat-feedback-lakebase) | Ask APEX chat feedback (👍/👎 + note) + Lakebase table |
| 7 | [G](#section-g--content-externalization) | Content externalization: user-facing copy → swappable strings |

Each PR must leave the app fully working (fail-soft intact) and carry its slice
of the agent-readiness docs.

**On Chainlit (considered, declined):** we evaluated replacing the Ask APEX chat
with Chainlit. Declined because (1) Chainlit ships its own branding/theming and
would have to be de-branded — contradicting the white-label thesis; (2) the
in-dashboard **rail** (`ConversationRail`) is an embedded component, not a
full-page chat, so Chainlit couldn't replace it — leaving two chat
implementations; (3) the valuable custom Genie MCP rendering (SQL, tables,
tool-call "under the hood" view, deep links) would be re-implemented inside
Chainlit's element model anyway; (4) it adds a heavy dependency + second server
process + its own data schema, against the minimal/transparent tenet. Instead we
fold the *feature* value we wanted (structured feedback) into the existing chat —
Section F.

---

## Section A — Theming foundation

**The spine. Everything else is built themeable on top of it.**

### Problem

Brand identity is scattered: "APEX"/"Advito" hardcoded in ~16 files;
indigo/violet Tailwind utilities hardcoded across ~34 files (~150 occurrences);
the logo is a literal `✦`/`A` glyph; `index.html` title is hardcoded; and
`server/auth/login.py` **re-declares** the hex palette in Python. "Change the
color" today is a whole-codebase find-and-replace.

### Design — one brand source, three consumers, zero duplication

**Single source of truth:** `brand.config.json` at repo root. Semantic tokens
only (names describe role, not color):

```jsonc
{
  "identity": {
    "appName": "APEX",
    "shortName": "APEX",
    "tagline": "Travel Intelligence",       // neutral; no customer-specific text
    "logo": "/brand/logo.svg",               // swap-in-place file
    "logoMark": "/brand/mark.svg",           // compact/collapsed sidebar mark
    "favicon": "/brand/favicon.svg"
  },
  "colors": {
    "primary": "#4f46e5",
    "primaryDark": "#3730a3",
    "primaryLight": "#e0e7ff",
    "accent": "#6366f1",
    "sidebarFrom": "#211d52",
    "sidebarTo": "#16142e",
    "bg": "#f8fafc",
    "border": "#e2e8f0"
  },
  "typography": {
    "fontSans": "Inter, system-ui, -apple-system, sans-serif",
    "fontDisplay": null
  }
}
```

**Consumer 1 — React app.** A `ThemeProvider` (mounted at app root) imports
`brand.config.json` and writes every token to CSS custom properties on
`:root` **at runtime** (`--brand-primary`, `--brand-sidebar-from`, …). Tailwind
v4 `@theme` in `index.css` maps utilities to those vars (e.g.
`--color-brand-primary: var(--brand-primary)`), so components use semantic
utilities: `bg-indigo-600` → `bg-brand-primary`. Because tokens are applied at
runtime through the provider, a future **per-tenant server payload** can swap
the whole theme with no component changes — this is the "runtime-ready" property.

**Consumer 2 — Python login page.** `server/auth/login.py` reads the *same*
`brand.config.json` (repo-root path, resolved once at import; fail-soft to
built-in defaults if unreadable) and interpolates identity + palette into its
HTML/CSS. No duplicated hex codes; the login screen always matches the app.

**Consumer 3 — HTML shell.** `index.html` title + favicon are injected at build
time from the same config (via a tiny Vite `define`/transform or a generated
snippet). No hardcoded `<title>`.

**Assets.** Brand images live in `frontend/public/brand/` (`logo.svg`,
`mark.svg`, `favicon.svg`) with documented, swap-in-place filenames. The sidebar
renders `logoMark` as an image, falling back to a **monogram generated from
`shortName`** when the file is absent — so the literal `✦` glyph is retired but
the app still looks intentional with no logo supplied.

### Migration

Mechanical, mostly find-and-replace, done as part of PR1 so later PRs are born
themeable: replace hardcoded `indigo`/`violet`/hex literals with semantic
`brand-*` utilities/vars across the ~34 files. Neutral grays (`slate-*`) that
are genuinely structural (borders, text) may stay as-is; only *brand* color
migrates. Remove customer-specific strings ("Advito Practice Exchange", "Advito
(All)") from defaults; keep "APEX" as the generic product name.

### Interfaces / boundaries

- `brand.config.json` — the only file you edit to rebrand.
- `frontend/src/theme/ThemeProvider.tsx` — reads config → sets CSS vars. Small,
  single-purpose. Exposes theme via context for the rare component that needs a
  raw value.
- `frontend/src/index.css` — `@theme` mapping semantic utilities → CSS vars.
- `server/auth/brand.py` — loads `brand.config.json` for the server side
  (single loader; fail-soft defaults baked in).

### Acceptance

- Editing `brand.config.json` (one color + `appName`) and swapping `logo.svg`,
  then rebuilding, rebrands the entire app **and** the login page. No other file
  edited.
- With no logo files present, the app renders a `shortName` monogram — no broken
  images, no literal `✦`.
- `grep -rn "indigo\|violet\|#4f46e5"` in `frontend/src` returns only the
  `@theme` mapping (and any deliberate one-offs), not scattered usage.

---

## Section B — Login split (operator vs user)

### Problem

One `/login` renders sample-login chips for **all** users, operator included —
no separation between the customer-facing door and the operator door.

### Design — one page, a top toggle, no extra URL

- **Single `/login` URL.** A **segmented toggle at the top** switches mode:
  **"Sign in"** (end users) / **"Operator"**. No `/login/operator` URL to
  remember (explicit user preference).
- The toggle controls **which sample-login chips show** (role-filtered:
  `user` chips vs the `operator` chip) and applies a **subtle visual cue** for
  the operator mode (e.g. an "Operator console" label / accent) so it's obvious
  which door is active. The POST handler is unchanged and shared — the split is
  purely presentation + chip filtering; role still comes from the directory, not
  the toggle (the toggle cannot escalate privilege).
- One shared Python template with a `variant`/`mode` parameter; chips are
  auto-filtered by role, so they stay correct with zero maintenance.
- **Knob:** `AUTH_SHOW_DEMO_LOGINS` (env, default: show only in demo; off when
  it looks like production) — one documented switch to hide all sample chips.
- Fully themed from `brand.config.json` (Section A) — no duplicated palette.

### Acceptance

- `/login` shows a user/operator toggle; user mode lists only `role:"user"`
  demo chips, operator mode lists only the operator chip.
- Signing in as any account still works via the same POST; role is honored from
  the directory regardless of toggle position.
- `AUTH_SHOW_DEMO_LOGINS=false` hides all chips; manual login still works.

---

## Section C — Admin information architecture

### Problem

One ~518-line `AdminPage` titled "Service Principals" stacks stats + tenant/SP
table + login-users table + activity feed. Per-tenant **asset access is trapped
in a per-row dialog** (`AccessDialog`) — the "so hidden" complaint. Assets
aren't a first-class concept; they exist only as env vars
(`RESOURCE_DASHBOARDS`/`RESOURCE_GENIE_SPACES`) surfaced inside that dialog.

### Design — one `/admin` layout, two focused pages

`/admin` becomes a thin layout with a two-item sub-nav under an
**"Administration"** group. Existing components are **reused and relocated**, not
rewritten.

#### C1. Manage Assets (`/admin/assets`)

Assets become first-class.

- **Registry table** — the dashboards & Genie spaces the app knows about, with
  their full spec (id, label, type, workspace/org, filter→widget wiring, pages,
  per-page Genie prompts). Add / edit / remove **in the UI**.
- **Access grid** — a **tenant × asset matrix** of toggles (the headline fix):
  every tenant's access to every asset, scannable at a glance, instead of
  buried per-row. Toggling maps to the existing `CAN_RUN` grant path
  (`resources.grant/revoke` → `set_access` audit). `AccessDialog`'s logic folds
  into the grid; the dialog component is removed.

**Source-of-truth boundary (reconciles "full spec in UI" with agent-ready):**
The full dashboard/Genie spec is **UI-managed** but backed by a **server-owned
repo seed file** `server/assets/dashboards.seed.json` (server-owned per research
R1 — both frontend and backend read it, exposed via `GET /api/assets`), seeded
from today's `config.ts` `DASHBOARDS` + `ROUTES` Genie wiring. Precedence mirrors
the proven `users.seed.json` pattern:

- **Lakebase OFF (default):** app reads the seed file; the registry table is
  **read-only** in the UI, with an inline note "enable Lakebase to edit assets
  here, or edit `dashboards.seed.json`". Nothing hard-breaks.
- **Lakebase ON:** a `apex_asset_registry` table overrides the seed; the UI
  writes there. The seed remains the documented fallback / initial import.

This keeps the editable source-of-truth a **file an agent can read and edit**,
while still delivering true in-UI management when persistence is on. `config.ts`
stops holding the registry; `App.tsx` routing consumes the resolved registry
(from an API that returns Lakebase-or-seed) instead of the static `DASHBOARDS`.

#### C2. Manage Users & Service Principals (`/admin/tenants`)

The identity/SP side, consolidated:

- Tenant + SP lifecycle table (onboard, rotate, deactivate, reactivate, delete,
  history) — today's `TenantTable`.
- Login-users table — today's `UsersTable`.
- Shared activity / audit feed — today's `ActivityFeed`.

### Interfaces / boundaries

- `frontend/src/pages/admin/AdminLayout.tsx` — sub-nav + `<Outlet/>`.
- `.../admin/AssetsPage.tsx` — registry table + access grid.
- `.../admin/TenantsPage.tsx` — SP lifecycle + users + audit.
- New API: `GET /api/assets` (resolved registry: Lakebase-or-seed),
  and (Lakebase-on) `POST/PUT/DELETE /api/assets/*`. Access grid reuses
  `/api/tenants/{id}/access` + `/api/tenants/resources`.
- Server: `server/assets/` module (registry read/resolve + optional Lakebase
  CRUD), mirroring `server/auth/users.py`'s file-or-Lakebase shape.

### Acceptance

- Admin nav shows two pages; no single page exceeds a reasonable size (the
  monolith is decomposed).
- A tenant × asset access grid is visible without opening any per-row dialog;
  toggling grants/revokes `CAN_RUN` and writes an audit row (unchanged backend).
- With Lakebase off, the app still renders dashboards/Genie from the seed file;
  the registry table shows read-only with the documented edit paths.
- With Lakebase on, adding an asset in the UI persists and appears in nav/grid.

### C — Re-brainstorm addendum (2026-07-27, before PR3 planning)

Re-brainstormed against current post-PR1/PR2 code (config.ts still holds
`DASHBOARDS`/`ROUTES`/`FILTERS`/GENIE configs unchanged; `server/assets/` does
not exist yet; server registry touchpoints = `GENIE_SPACE_ID`, `DASHBOARD_IDS`,
`RESOURCE_DASHBOARDS/GENIE_SPACES` in `resources.py`/`service.py`, and
`_DEFAULT_DASHBOARD_ID` from `DASHBOARD_URL` in `embed.py`). Decisions:

- **Full spec in UI — confirmed.** Retire `config.ts` `DASHBOARDS`; the full
  dashboard spec (id, label, workspace/org, `filters` FilterKey→widgetId map,
  `pages`, per-page Genie prompts) moves to a server-owned
  `server/assets/dashboards.seed.json` + optional `apex_asset_registry` Lakebase
  override, exposed via `GET /api/assets`.
- **Async risk neutralized via a boot-time `RegistryProvider`.** The registry is
  fetched ONCE at app boot (a sibling to `ThemeProvider`), which shows an
  app-shell skeleton until resolved, then exposes the resolved registry through
  `useRegistry()` context. `App.tsx`/`CustomDashboard`/`FilterBar`/Genie rail /
  Exec Summary consume it **synchronously** — one loading gate at the shell, NOT
  per-component loading states. This is the key design move that keeps the change
  contained.
- **Frontend fail-soft = bundled seed copy.** The frontend also imports the seed
  JSON at build time (like `brand.config.json`); if `GET /api/assets` fails, the
  provider falls back to the bundled copy so the app always renders (preserves
  zero-infra demo promise). Accepted trade-off: the seed ships in the bundle AND
  is read by the server.
- **`FILTERS` catalog + `FilterKey` type STAY in `config.ts`** — they define how
  a filter renders (widget kind/options/labels), a UI concern. The registry's
  per-dashboard `filters` map only references those keys. So: seed = data, filter
  vocabulary = code. Document this seam explicitly.
- **`ROUTES` stays in `config.ts`** for nav concerns (order, icon, section,
  non-dashboard pages: Home, Ask APEX, My Filters). A dashboard nav entry
  references a registry key (as `dashboard: "apex"` today). Registry owns specs;
  ROUTES owns nav.
- **Delivery = TWO sub-PRs:**
  - **PR3a (plumbing, no visible admin change):** `server/assets/` module
    (seed-or-Lakebase resolve, mirroring `server/auth/users.py`) + `server/assets/dashboards.seed.json`
    (seeded from current `config.ts` DASHBOARDS + ROUTES Genie wiring) + `GET /api/assets`
    + frontend `RegistryProvider` (`useRegistry()`, bundled-seed fallback) +
    retire `config.ts` `DASHBOARDS` (App/CustomDashboard/FilterBar/rail read the
    registry). Server touchpoints (`grant_dashboard_access`, `resources.catalog`,
    embed default) derive from the resolved registry instead of separate env vars
    (env becomes fallback). End state: app behaves identically, registry is the
    single source.
  - **PR3b (admin IA):** `AdminLayout` + two sub-nav pages — **Manage Assets**
    (registry table with add/edit/remove when Lakebase on, read-only+seed note
    when off; tenant×asset **access grid** folding in `AccessDialog`'s grant/revoke
    logic) and **Manage Users & SPs** (relocate `TenantTable` + `UsersTable` +
    `ActivityFeed`). Remove the `AccessDialog` component.

---

## Section D — SP creation (onboarding flow)

### Problem

`OnboardDialog` is a functional single modal, but it's **disconnected from the
"now create the matching login user" step** it instructs the operator to do —
easy to forget, and the tenant_id coupling is the confusing part.

### Design — a guided flow that models the real 3 steps

Replace the single modal with a stepped flow (reusing existing APIs + dialog
logic):

1. **Pick client** — from governed data, as today (`available-clients`).
2. **Provision SP** — create + reveal secret **once**, as today (`onboard`).
   Secret-handling invariant preserved.
3. **Create login user** — pre-filled with the just-onboarded **`tenant_id`**
   (the currently-manual, easy-to-miss step), reusing `UserDialog` /
   `createAppUser`. Skippable (e.g. when the login user already exists), but
   surfaced by default with progress so it can't be silently missed.

Same underlying endpoints; the improvement is **sequencing + pre-fill + progress**,
so the tenant↔SP↔login-user relationship is obvious.

### Acceptance

- Onboarding walks pick → provision → create-user in one coherent flow with
  visible progress.
- Step 3 is pre-filled with the correct `tenant_id`; completing it yields a
  login user that can sign in and resolve to the new tenant SP.
- The one-time secret is still shown once and never persisted in plaintext.

---

## Section E — UI polish & consistency

Scoped consistency pass, not a rewrite:

- Consistent page headers, spacing, and empty/loading/error states across pages.
- Sidebar logo reads from `brand.config.json` (logo image → `shortName`
  monogram fallback); the literal `✦` is gone.
- All brand color flows through Section A's semantic tokens; audit for stragglers.
- Modern but restrained — no new component framework, no dependency additions
  beyond what exists.

### Acceptance

- Visual consistency across pages (headers/spacing/states) is demonstrably
  improved; no regressions in existing flows.
- No hardcoded brand color or brand string remains outside the theme/brand
  config (grep-clean, per Section A acceptance).

---

## Section F — Ask APEX chat feedback (Lakebase)

**The feature value we wanted from Chainlit, folded into the existing chat.**

### Problem

There's no way for a user to signal whether a Genie answer was good — the single
most useful signal for improving a Genie space (and the "agent quality" story a
flagship repo should demonstrate). Chainlit offers this out of the box; we add it
natively so it stays on-brand and transparent.

### Design — thumbs + optional note on assistant messages, fail-soft

**Backend (`server/persistence.py` + `server/routes/apex.py`):**

- New table `apex_message_feedback`, created lazily in `SCHEMA_SQL` alongside the
  existing tables:

  ```sql
  CREATE TABLE IF NOT EXISTS apex_message_feedback (
      message_id  UUID NOT NULL REFERENCES apex_messages(id) ON DELETE CASCADE,
      user_email  VARCHAR(255) NOT NULL,
      rating      SMALLINT NOT NULL,           -- 1 = up, -1 = down
      note        TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (message_id, user_email)
  );
  ```

  Upsert semantics (a user can change 👍↔👎 or edit the note): `ON CONFLICT
  (message_id, user_email) DO UPDATE`. Scoped by `user_email` like every other
  row; ownership verified via the parent conversation (a user can only rate a
  message in a conversation they own — reuse the `_owns` check by joining
  `apex_messages` → `apex_conversations`).

- **Surface the persisted assistant message id.** Today `save_turn` inserts the
  assistant message but does not return its UUID, and `get_conversation` maps
  payload fields but drops the row id. Both change minimally to include the
  assistant message's `id::text` so the frontend has a stable feedback target.
  This is the one load-bearing change to existing persistence functions;
  everything else is additive.

- New functions `set_message_feedback(message_id, user_email, rating, note)` and
  (for replay) feedback is returned inline by `get_conversation` per assistant
  message. Both guard on `enabled()` and no-op / return empty when Lakebase is
  off — identical shape to the existing functions.

- New route `POST /api/apex/messages/{message_id}/feedback` (session-authed,
  `user_email` from the session — never the client). Returns `{ok, persisted}`.

**Frontend (`useGenieMcpChat.ts` + a small `MessageFeedback` component):**

- `GenieMcpMessage` gains an optional `dbId?: string` (the persisted UUID) and
  `feedback?: { rating: 1 | -1; note?: string } | null`. `saveConversationTurn`
  already returns after persist; extend its response to carry the assistant
  `dbId`, set on the draft. `loadConversation` maps stored feedback back in.
- A `MessageFeedback` control (👍/👎 + expandable note) renders on **completed
  assistant messages that have a `dbId`** — i.e. only when the turn was persisted
  (Lakebase on). When Lakebase is off there is no `dbId`, so the control simply
  doesn't render. **This is the fail-soft boundary — no new degraded path.**
- Themed entirely via Section A brand tokens.
- Because all three chat surfaces share `useGenieMcpChat`, the rail, standalone
  page, and MCP view get feedback uniformly — the exact consistency win Chainlit
  would have broken.

### Interfaces / boundaries

- `server/persistence.py` — `apex_message_feedback` schema +
  `set_message_feedback`; `save_turn`/`get_conversation` surface the assistant
  message id + feedback. Additive, fail-soft.
- `server/routes/apex.py` — `POST /apex/messages/{id}/feedback`.
- `frontend/src/components/genie/MessageFeedback.tsx` — the 👍/👎 + note control.
- `useGenieMcpChat.ts` — carries `dbId` + `feedback`; a `submitFeedback(dbId,
  rating, note)` callback.

### Acceptance

- On a persisted Ask APEX answer, a user can click 👍/👎 and optionally add a
  note; it persists and survives reload/replay of that conversation.
- Changing the rating or editing the note upserts (no duplicate rows).
- With Lakebase **off**, the chat works exactly as today with no feedback control
  and no errors.
- Feedback is scoped to the owning user; a user cannot rate messages in a
  conversation they don't own (verified server-side).

## Section G — Content externalization

**Added after the PR1 visual checkpoint (2026-07-27).** The rebrand-swap test
proved colors/logo/app-name flip from `brand.config.json` alone — but hardcoded
*copy* (hero eyebrow "APEX TRAVEL INTELLIGENCE", quick-card descriptions,
empty-state text, page blurbs) stayed put, so a rebranded app still reads as
travel-specific APEX. For a true white-label reference repo, user-facing copy
must be swappable too. This is a **distinct axis from color theming** (strings,
not CSS tokens) and is therefore its own PR, sequenced **after** the PR1 color
migration completes — not folded into the theming foundation.

### Design — a single strings source, same file-first / agent-ready ethos

- **`content.config.json`** (repo root, sibling to `brand.config.json`) — a
  namespaced strings document: e.g. `{ home: { heroEyebrow, heroTagline,
  quickCards: [...] }, askApex: { title, subtitle, starters: [...] }, nav: {...},
  common: {...} }`. Edited by hand (agent-ready) like `brand.config.json`.
- **Frontend consumer** — a tiny `content.ts` (typed import) + a `t(path)` helper
  (or a `useContent()` hook) so components read `content.home.heroEyebrow` instead
  of a literal. No i18n runtime/library dependency for the base case — this is
  string externalization, not multi-locale (locale support can layer on later via
  the same file shape keyed by lang).
- **Boundary with existing config:** nav labels already live in `config.ts`
  `ROUTES` and dashboard/Genie copy will live in the PR3 asset registry
  (`dashboards.seed.json`). Section G covers the **remaining static UI/marketing
  copy only** — it must not duplicate strings those own. The brief will classify
  each of the ~visible strings as brand-copy (externalize), UI-chrome (leave), or
  product-content-owned-elsewhere (leave).
- **Scope discipline:** externalize *user-facing brand/marketing copy*, not every
  label, aria string, or developer message. Over-externalization hurts
  readability — YAGNI applies.

### Acceptance

- Editing `content.config.json` (e.g. hero eyebrow + a card description) and
  reloading changes that copy with no code edit.
- The NOVA rebrand-swap test (from the PR1 checkpoint) shows **no residual
  "APEX"/"travel" copy** in externalized surfaces after swapping both
  `brand.config.json` and `content.config.json`.
- Nav labels (ROUTES) and asset copy (registry) are NOT duplicated into
  `content.config.json`.
- `tsc -b && vite build` clean; no new runtime dependency added for the base
  (single-language) case.

## 7. Agent-readiness deliverables

Shipped incrementally with the PR that introduces each concern; consolidated in
`AGENTS.md` + a new `docs/customizing.md`:

**"Change X → edit Y" map:**

| To change… | Edit… |
|------------|-------|
| Colors, app name, tagline, fonts | `brand.config.json` |
| User-facing copy (hero, cards, blurbs) | `content.config.json` *(added in PR7)* |
| Logo / favicon | files in `frontend/public/brand/` |
| Dashboards & Genie spaces (specs, wiring, prompts) | `server/assets/dashboards.seed.json` (or Manage Assets UI when Lakebase on) |
| Which filters exist / how they render | `frontend/src/config.ts` (FILTERS) |
| Login demo chips on/off | `AUTH_SHOW_DEMO_LOGINS` env |
| Nav order, labels, icons, non-dashboard pages | `frontend/src/config.ts` (ROUTES) |
| Per-tenant asset access | Manage Assets → access grid |
| Chat feedback storage / schema | `server/persistence.py` (`apex_message_feedback`) |
| Server data assets / SP / Lakebase / RLS | `.env` (grouped, as documented in README) |

## Testing strategy

- **Theming (A):** rebrand-swap test — change `brand.config.json` + logo,
  rebuild, verify app + login reflect it; grep-clean assertion for stray brand
  literals. Monogram fallback with no logo file.
- **Login (B):** toggle filters chips by role; POST honors directory role
  regardless of toggle; `AUTH_SHOW_DEMO_LOGINS=false` hides chips.
- **Admin IA (C):** registry resolves Lakebase-or-seed (both modes); access grid
  toggling calls the existing grant/revoke path and audits; app renders from
  seed with Lakebase off.
- **Onboarding (D):** flow completes pick→provision→create-user; tenant_id
  pre-fill correct; secret shown once.
- **Chat feedback (F):** 👍/👎 + note persists and replays; rating change/note
  edit upserts (no dup rows); Lakebase-off hides the control with no errors;
  feedback is user-scoped and ownership-enforced server-side.
- Preserve existing behavior: run current backend + `tsc -b && vite build`
  clean after each PR. Fail-soft paths (Lakebase off, auth off) verified per PR.

## Resolved design decisions (from pre-plan research, 2026-07-27)

Three parallel read-only research agents (brand-literal audit, config-flow trace,
Tailwind v4 mechanics) resolved the prior open questions. Findings:

### R1. Seed file is **server-owned**, exposed via `GET /api/assets`

The **server independently needs** dashboard/Genie ids — it is not a
frontend-only concern:
- `server/tenants/service.py` `grant_dashboard_access` (reads `DASHBOARD_IDS`) and
  `grant_genie_access` (uses `GENIE_SPACE_ID`) grant CAN_RUN at onboard time.
- `server/tenants/resources.py` `catalog()` builds the grantable resource list
  (`RESOURCE_DASHBOARDS`/`RESOURCE_GENIE_SPACES`) for the admin access grid.
- `server/routes/embed.py` derives a default dashboard id for embed-token minting.

**Decision:** the resolved registry lives server-side (`server/assets/`), reading
`dashboards.seed.json` with an optional `apex_asset_registry` Lakebase override —
mirroring `server/auth/users.py`'s file-or-Lakebase shape. The frontend consumes
it via **`GET /api/assets`** (cached at app load); `config.ts` `DASHBOARDS` and
the `GENIE_*` prompt consts are retired in favor of that fetch. The env vars
(`DASHBOARD_IDS`, `RESOURCE_*`, `GENIE_SPACE_ID`) become **fallbacks** the seed
resolver can derive from, preserving fail-soft.

### R2. `ROUTES` stays **separate** from the asset registry

Only 2 of 6 routes are dashboards (`/spend-custom`, `/sustainability`, both
`dashboard: "apex"`); the other 4 (`/`, `/genie-mcp`, `/ask-apex-live`,
`/preferences`) are non-dashboard React pages. The registry owns **dashboard
specs + Genie configs**; `ROUTES` in `config.ts` keeps **nav order, labels,
icons, sections, and non-dashboard pages**. A route references a registry entry
by key (as it references `dashboard: "apex"` today). Minimal churn, clean seam.

### R3. Tailwind v4 theming uses the **`@theme inline` two-layer pattern**

Confirmed against current v4 docs:
- **Layer 1** — raw `--brand-*` vars on `:root` in `index.css`, holding real
  **default** hex values (so first paint is branded, no FOUC). The
  `ThemeProvider` overwrites these on `document.documentElement` at runtime via
  `setProperty` — this is what makes the theme swappable with no rebuild and
  future per-tenant/scoped theming possible.
- **Layer 2** — `@theme inline { --color-brand-primary: var(--brand-primary); … }`
  maps Tailwind's color namespace onto the raw vars. `inline` is required (not
  plain `@theme`) so utilities resolve the var **at the element**, enabling
  scoped/dark overrides later.
- **Gradients:** migrate `bg-gradient-to-*` → v4 `bg-linear-to-*`; gradient
  stops (`from-/via-/to-`) work with `--color-brand-*` tokens. Multi-stop hero +
  sidebar gradients get named tokens (`--brand-sidebar-from/via/to`).
- **Gotcha (must honor):** `color-mix()`-based opacity (`bg-brand-primary/10`)
  and `from-*`-only gradients **silently drop** if a brand var is unset. Defense:
  always ship valid defaults in `:root` and/or bake fallbacks into tokens
  (`--color-brand-primary: var(--brand-primary, #4f46e5)`).
- **Font** tokens (`--font-sans: var(--brand-font-sans)`) swap the same way.
- Current `index.css` uses literal `--color-apex-*` under plain `@theme` (static);
  the refactor moves values to raw `:root` vars + `@theme inline`. Utility class
  names can stay stable, minimizing component churn beyond the color-literal sweep.

**Migration scale (from audit):** ~260 brand-color utility usages + 7 inline hex,
35+ brand strings, 18 gradients, across 33 frontend files + `server/auth/login.py`.
Tier-1 (highest effort): `GenieMcpExperience.tsx`, `AskApexLive.tsx`,
`ConversationRail.tsx`, `HomePage.tsx`. Structural `slate/white/black` stays.
Note `login.py` also hardcodes `--purple:#7c3aed` / `#6d28d9` not present in the
frontend palette — reconcile to the shared brand tokens.
```
