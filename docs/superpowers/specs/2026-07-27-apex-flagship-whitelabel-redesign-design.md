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

Each PR must leave the app fully working (fail-soft intact) and carry its slice
of the agent-readiness docs.

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
The full dashboard/Genie spec is **UI-managed** but backed by a **repo seed
file** `frontend/src/config/dashboards.seed.json` (or `server/`-side equivalent
if the server must read it too — see Open Questions), seeded from today's
`config.ts` `DASHBOARDS` + `ROUTES` Genie wiring. Precedence mirrors the proven
`users.seed.json` pattern:

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

## 7. Agent-readiness deliverables

Shipped incrementally with the PR that introduces each concern; consolidated in
`AGENTS.md` + a new `docs/customizing.md`:

**"Change X → edit Y" map:**

| To change… | Edit… |
|------------|-------|
| Colors, app name, tagline, fonts | `brand.config.json` |
| Logo / favicon | files in `frontend/public/brand/` |
| Dashboards & Genie spaces (catalog + wiring) | `dashboards.seed.json` (or Manage Assets UI when Lakebase on) |
| Which filters exist / how they render | `frontend/src/config.ts` (FILTERS) |
| Login demo chips on/off | `AUTH_SHOW_DEMO_LOGINS` env |
| Nav sections / routes | resolved registry + `config.ts` ROUTES |
| Per-tenant asset access | Manage Assets → access grid |
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
- Preserve existing behavior: run current backend + `tsc -b && vite build`
  clean after each PR. Fail-soft paths (Lakebase off, auth off) verified per PR.

## Open questions (resolve during planning, not blocking)

1. **Seed-file location & who reads it.** If only the frontend needs the
   registry, `frontend/src/config/dashboards.seed.json` is simplest. If the
   server must also resolve it (e.g. to grant CAN_RUN or drive embed), put it
   where both can read (repo root or `server/`) and expose via `GET /api/assets`.
   Leaning: **server-owned seed + `GET /api/assets`**, so frontend and backend
   share one resolved source (consistent with the users.py file-or-Lakebase
   shape). Confirm in planning.
2. **Registry ↔ routes.** Today `ROUTES` (nav) and `DASHBOARDS` (specs) are
   separate in `config.ts`. Decide whether the asset registry subsumes nav
   entries or stays specs-only with `ROUTES` still declaring nav order/labels.
   Leaning: registry = asset specs; `ROUTES` keeps nav order + non-dashboard
   pages (Home, Ask APEX, My Filters). Minimal churn.
3. **Tailwind v4 token wiring** — confirm the `@theme` + CSS-var indirection
   supports the handful of gradient/opacity usages (sidebar gradient, hero) as
   cleanly as flat colors; a few may need explicit gradient tokens.
```
