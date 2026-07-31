# Prism Phase 5 (Login) — Server Login Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the server-rendered login page (`server/auth/login.py`) onto canonical DuBois styling — DuBois blue `#2272b4`, warm neutrals, 4px/8px radii, SF-Pro, 13px base — and fix the brand-color source split so the login screen matches the app, preserving ALL authentication behavior.

**Architecture:** Two ordered tasks touching the backend only. (1) **Color source fix** — the login page reads `colors['primary'|'primaryDark'|'sidebarFrom'|'primaryLight']` etc. from `load_brand()`, but Phase 2 slimmed `brand.config.json` `colors` to just `{accent}`, so those fall through to `DEFAULT_BRAND` which is still stale **indigo `#4f46e5`**. Retune `DEFAULT_BRAND.colors` to canonical DuBois so the login (and any other server consumer) renders in the app's blue. (2) **Reskin the inline CSS** in `_render_login_page` to DuBois-faithful values (radii, neutrals, typography, focus/hover states, gradient, chips, toggle, error), keeping the exact HTML structure, form fields, mode toggle, demo chips, and JS untouched.

**Tech Stack:** Python 3.12 + FastAPI (server-rendered HTML string), pytest. No React/frontend involvement — the login page is a standalone server response with no frontend equivalent.

## Global Constraints

- **This is a DELIBERATE, SCOPED exception to the frontend-only rule** (user-approved 2026-07-31): the login page is the one user-facing surface with NO frontend component — it's server-rendered HTML in `server/auth/login.py`. Reskinning it necessarily edits `server/`. This exception is limited to login presentation (`_render_login_page` HTML/CSS) + the `DEFAULT_BRAND.colors` values. **Do NOT touch** any auth logic, routes, session, password, or middleware code.
- **Preserve ALL auth behavior verbatim** — the `POST /login` handler, `_safe_next`, session cookie creation, `verify_login`, the `mode` form field (and the role-can't-escalate invariant), demo-chip gating (`AUTH_SHOW_DEMO_LOGINS`), `next_url` hidden field, error re-render. Only the HTML/CSS string content changes; the form's `method`/`action`/field `name`s, the mode-toggle `data-*` hooks, and the `<script>` behavior stay byte-identical in contract.
- **Canonical DuBois values (source of truth — from `frontend/src/index.css` :root):** primary `#2272b4`, primary-hover/darker `#0e538b` (blue-700), primary-foreground `#ffffff`, background `#ffffff`, foreground `#161616`, secondary/muted `#f7f7f7`, muted-foreground `#6f6f6f`, border `#ebebeb`, input border `#cbcbcb`, destructive `#c82d4c`, danger bg `#fff5f7` / border `#fbd0d8`, radius base 4px / container 8px, AI gradient `linear-gradient(135deg,#4299e0 20.5%,#ca42e0 46.91%,#ff5f46 79.5%)`, system font stack `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,...`, base 13px. font-semibold = 600 (never 700/800).
- **Keep the login self-contained** (no import of frontend assets/Tailwind — it's a standalone HTML doc); express DuBois via literal hex + inline CSS matching the tokens above.
- **Both tasks end green:** `python3 -m pytest tests/test_login_toggle.py tests/test_brand.py -q` passes (run pytest DIRECTLY as `python3 -m pytest`, NOT via any rtk wrapper). Plus a live check: run the app and load `/login` in Chrome (light; the login page is a fixed light design — it does not theme dark). Push to `feature/apex-theming`, no PRs.

---

## File Structure

**Modified:**
- `server/brand.py` — retune `DEFAULT_BRAND.colors` indigo → canonical DuBois (Task 1).
- `server/auth/login.py` — reskin the CSS + minor markup classes in `_render_login_page` (Task 2).

**Possibly modified (tests):**
- `tests/test_login_toggle.py` — only if a reskin renames a `data-*`/structural hook a test asserts (the plan keeps all of them, so likely NO change; verify).
- `tests/test_brand.py` — asserts colors `startswith("#")` only; the DEFAULT_BRAND retune keeps them hex, so NO change expected (verify).

**Untouched:** all auth logic, routes, sessions, users repo, middleware, the entire frontend.

---

### Task 1: Fix the brand-color source (indigo → canonical DuBois)

The login page interpolates `colors['primary']`, `['primaryDark']`, `['primaryLight']`, `['accent']`, `['sidebarFrom']` from `load_brand()`. Since `brand.config.json` `colors` was slimmed to `{accent:"#2272b4"}` in Phase 2, all the others fall through to `DEFAULT_BRAND.colors` — still the pre-Prism **indigo** palette. Retune `DEFAULT_BRAND.colors` to canonical DuBois so the login renders on-brand. This alone converts the login from indigo to DuBois blue even before the CSS reskin.

**Files:**
- Modify: `server/brand.py:29-40` (`DEFAULT_BRAND["colors"]`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `DEFAULT_BRAND["colors"]` with canonical DuBois hex values. Keys stay the SAME (`primary`, `primaryDark`, `primaryLight`, `accent`, `accentDark`, `sidebarFrom`, `sidebarVia`, `sidebarTo`, `bg`, `border`) so every existing `colors['…']` interpolation in `login.py` keeps resolving — only the values change.

- [ ] **Step 1: Retune `DEFAULT_BRAND["colors"]` to canonical DuBois**

In `server/brand.py`, replace the `"colors"` block (lines 29-40) with canonical DuBois values (same keys):

```python
    "colors": {
        "primary": "#2272b4",        # DuBois blue-600
        "primaryDark": "#0e538b",    # blue-700
        "primaryLight": "#d7edfe",   # blue-200 (focus ring tint)
        "accent": "#2272b4",         # same as primary (single-accent brand)
        "accentDark": "#0e538b",
        "sidebarFrom": "#04355d",    # blue-800 (deep) — login bg gradient start
        "sidebarVia": "#0e538b",     # blue-700
        "sidebarTo": "#2272b4",      # blue-600
        "bg": "#f7f7f7",             # secondary warm-grey
        "border": "#ebebeb",         # neutral-100
    },
```

Rationale: `login.py`'s body background is `linear-gradient(135deg, sidebarFrom 0%, primaryDark 50%, primary 100%)` — a blue depth gradient now (was indigo). `primaryLight` is the focus-ring tint. Keeping all keys means no `login.py` change is needed for the colors to flow.

- [ ] **Step 2: Run the tests**

Run: `cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi && python3 -m pytest tests/test_brand.py tests/test_login_toggle.py -q`
Expected: PASS. `test_brand.py` only asserts colors `startswith("#")` and an `appName == "APEX"`; `test_brand_color_helper` references `#4f46e5` only as a Python default-arg literal for a *nonexistent* key, so it's unaffected. If any test hard-codes an indigo hex, update the assertion to the new canonical value (don't expect this).

- [ ] **Step 3: Commit**

```bash
git add server/brand.py
git commit -m "fix(login): retune DEFAULT_BRAND colors indigo -> canonical DuBois blue

Phase 2 slimmed brand.config colors to {accent}; the server login read
primary/primaryDark/sidebarFrom from DEFAULT_BRAND, which was still the
pre-Prism indigo -> login rendered off-brand. Retune to DuBois blue so the
login screen matches the app.

Co-authored-by: Isaac"
```

---

### Task 2: Reskin the login CSS to canonical DuBois

Rewrite the `<style>` block (and a few class values) inside `_render_login_page` so the login is DuBois-faithful: white card with 8px radius + DuBois shadow, 4px-radius inputs with the canonical border + blue focus ring, a filled DuBois-blue primary button, warm-neutral chips/toggle/divider, DuBois destructive error styling, 13px SF-Pro type at weight 600 for emphasis. HTML structure, form fields, mode toggle, chips markup, and `<script>` stay unchanged.

**Files:**
- Modify: `server/auth/login.py:72-115` (the `<style>` block) and the `.brand .logo` monogram styling; keep everything else in `_render_login_page` intact.

**Interfaces:**
- Consumes: `colors` from `load_brand()` (now canonical from Task 1) — `colors['primary']`, `['primaryDark']`, `['primaryLight']`, `['accent']`, `['sidebarFrom']`.
- Produces: same rendered HTML contract (all `class`/`data-*`/`id`/`name` hooks unchanged) with DuBois CSS. The tests in `test_login_toggle.py` assert on `data-mode-toggle`, `data-mode="…"`, `data-role="…"`, `data-active-mode="…"`, `class="chip"`, `name="username"` — ALL preserved.

- [ ] **Step 1: Rewrite the `<style>` block to canonical DuBois**

In `server/auth/login.py`, replace the `<style>…</style>` block (lines 72-115) with the following. Note the doubled braces `{{ }}` (this is inside a Python f-string) and the `{colors[...]}` interpolations are preserved exactly where the current code has them.

```python
<style>
  :root {{ --brand:{colors['primary']}; --brand-dark:{colors['primaryDark']}; --brand-accent:{colors['accent']}; --ring:{colors['primaryLight']}; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
         font-size:13px; line-height:20px; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:linear-gradient(135deg,{colors['sidebarFrom']} 0%,{colors['primaryDark']} 50%,{colors['primary']} 100%); color:#161616;
         -webkit-font-smoothing:antialiased; }}
  .card {{ width:380px; background:#ffffff; border-radius:8px; border:1px solid #ebebeb;
          box-shadow:0px 8px 40px 0px rgba(0,0,0,0.13); padding:28px 26px 24px; }}
  .brand {{ display:flex; align-items:center; gap:9px; margin-bottom:4px; }}
  .brand .logo {{ width:30px;height:30px;border-radius:6px;
                 background:linear-gradient(135deg,#4299e0 20.5%,#ca42e0 46.91%,#ff5f46 79.5%);
                 display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:14px; }}
  .brand h1 {{ font-size:18px; line-height:24px; margin:0; font-weight:600; letter-spacing:-0.01em; color:#161616; }}
  .sub {{ color:#6f6f6f; font-size:13px; margin:4px 0 18px 1px; }}
  label {{ font-size:13px; font-weight:600; color:#161616; display:block; margin:12px 0 6px; }}
  input {{ width:100%; padding:8px 12px; border:1px solid #cbcbcb; border-radius:4px; font-size:13px; line-height:20px;
          color:#161616; background:#ffffff; }}
  input::placeholder {{ color:#6f6f6f; }}
  input:focus {{ outline:none; border-color:var(--brand); box-shadow:0 0 0 2px var(--ring); }}
  button.submit {{ width:100%; margin-top:18px; padding:9px; border:0; border-radius:4px; color:#ffffff;
                  font-size:13px; font-weight:600; cursor:pointer; background:var(--brand); transition:background .12s; }}
  button.submit:hover {{ background:var(--brand-dark); }}
  .divider {{ display:flex; align-items:center; gap:10px; color:#6f6f6f; font-size:12px;
             text-transform:uppercase; letter-spacing:.08em; margin:20px 0 12px; }}
  .divider::before, .divider::after {{ content:""; flex:1; height:1px; background:#ebebeb; }}
  .chips {{ display:flex; flex-direction:column; gap:8px; }}
  .chip {{ text-align:left; background:#f7f7f7; border:1px solid #ebebeb; border-radius:4px;
          padding:9px 11px; cursor:pointer; display:grid; grid-template-columns:1fr auto; row-gap:2px; transition:background .12s,border-color .12s; }}
  .chip:hover {{ border-color:var(--brand); background:#f0f8ff; }}
  .chip-name {{ font-size:13px; font-weight:600; color:#161616; }}
  .chip-tenant {{ font-size:12px; color:#fff; background:var(--brand); border-radius:999px;
                 padding:1px 8px; justify-self:end; font-weight:500; }}
  .chip-cred {{ grid-column:1 / -1; font-size:12px; color:#6f6f6f; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }}
  .error {{ background:#fff5f7; color:#9e102c; border:1px solid #fbd0d8; border-radius:4px;
           padding:8px 10px; font-size:13px; margin-bottom:12px; }}
  .foot {{ text-align:center; color:#6f6f6f; font-size:12px; margin-top:16px; }}
  .mode-toggle {{ display:flex; gap:4px; background:#f7f7f7; border:1px solid #ebebeb; border-radius:6px; padding:3px; margin-bottom:16px; }}
  .mode-btn {{ flex:1; border:0; background:transparent; padding:6px 10px; border-radius:4px;
              font-size:13px; font-weight:600; color:#6f6f6f; cursor:pointer; transition:background .12s,color .12s; }}
  .mode-btn.active {{ background:#ffffff; color:var(--brand); box-shadow:0px 1px 0px 0px rgba(0,0,0,0.05); }}
  body[data-active-mode="operator"] .brand h1::after {{
     content:" · Operator"; color:var(--brand); font-weight:600; font-size:13px; }}
  body[data-active-mode="user"] .chip[data-role="operator"] {{ display:none; }}
  body[data-active-mode="operator"] .chip[data-role="user"] {{ display:none; }}
</style>
```

Key DuBois changes vs. the old CSS: card 18px→8px radius + `#ebebeb` border + DuBois xl shadow; body font 13px/20px + SF-Pro + `#161616` text; inputs 10px→4px radius, `#cbcbcb` border, 2px blue focus ring (`primaryLight`); submit is a FLAT DuBois-blue fill (not a gradient), hover → `primaryDark`; the `.brand .logo` monogram now uses the canonical AI gradient; chips/toggle/divider/error/foot all on warm neutrals + DuBois destructive; the mode toggle is a DuBois segmented control (`#f7f7f7` bg + border, white active with subtle shadow); weights are 600 max (no 800). Focus ring uses `--ring` = `primaryLight` (#d7edfe).

- [ ] **Step 2: Verify the HTML structure/hooks are untouched**

Confirm the reskin changed ONLY CSS (and the monogram gradient), not the markup the tests + JS depend on:
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi
grep -n 'data-mode-toggle\|data-mode="user"\|data-mode="operator"\|data-role=\|data-active-mode\|class="chip"\|name="username"\|name="password"\|name="mode"\|name="next"\|action="/login"' server/auth/login.py
```
Expected: all still present (the `<form>`, mode toggle buttons, chips loop, hidden inputs, `<script>` are unchanged).

- [ ] **Step 3: Run the tests**

Run: `cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi && python3 -m pytest tests/test_login_toggle.py tests/test_brand.py -q`
Expected: PASS (all 11). The reskin preserves every asserted hook (`data-mode-toggle`, `data-mode="…"`, `data-role="…"`, `data-active-mode="…"`, `class="chip"`, `name="username"`, and the role-escalation POST test). If a test fails, a required `data-*`/class/name hook was altered — restore it (CSS-only changes should not break these).

- [ ] **Step 4: Live check**

Run the app locally and load the login page in Chrome:
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi
# start the server however the repo runs it (e.g. uvicorn app:app --port 8000), then open http://localhost:8000/login?mode=user
```
(Use the web-devloop-tester / a browser to open `/login`.) Verify:
- Card is white, 8px radius, subtle border + soft shadow, on a DEEP BLUE depth gradient background (NOT indigo).
- The monogram logo box shows the AI gradient (blue→magenta→orange-red).
- Inputs are 4px-radius with a grey border; focusing shows a 2px blue ring.
- The "Sign in" button is FLAT DuBois blue `#2272b4`, darkening on hover.
- The Sign in / Operator segmented toggle works; switching to Operator adds " · Operator" to the title and filters the demo chips by role.
- Demo chips are warm-grey cards; clicking one fills email+password.
- Type reads at ~13px in the system font; nothing indigo remains.
- Submit a wrong password → the DuBois-styled red error banner appears; a correct demo login redirects into the app.

- [ ] **Step 5: Commit**

```bash
git add server/auth/login.py
git commit -m "feat(login): reskin server login page to canonical DuBois

White 8px card + DuBois shadow, 4px inputs with blue focus ring, flat
DuBois-blue submit, warm-neutral chips/toggle/divider, DuBois destructive
error, 13px SF-Pro. All auth logic, form fields, mode toggle, chips, and
JS unchanged.

Co-authored-by: Isaac"
```

---

## Self-Review

**Spec coverage (Phase 5 = pages reskinned; this plan = the Login group):**
- "login" reskinned onto DuBois → Task 2 (CSS) + Task 1 (color source). ✅
- KEEP all feature logic, swap presentation only → Global Constraints + both tasks touch only CSS/color values + `DEFAULT_BRAND` values; no auth-logic edits; test hooks preserved. ✅
- Canonical DuBois values (blue #2272b4, 4/8px radii, warm neutrals, SF-Pro, AI gradient, weight 600) → Task 2 Step 1 CSS. ✅

**Type/contract consistency:** `DEFAULT_BRAND["colors"]` keeps every key (Task 1) that `login.py` interpolates (Task 2 references `primary`/`primaryDark`/`primaryLight`/`accent`/`sidebarFrom`) — no missing-key KeyError. All test-asserted hooks (`data-mode-toggle`, `data-mode`, `data-role`, `data-active-mode`, `class="chip"`, `name="username"`) preserved (Task 2 Step 2 verifies).

**Placeholder scan:** No TBD/"handle edge cases". Task 1 and Task 2 Step 1 give the exact literal values. The live check (Task 2 Step 4) describes the exact server-run + verification; the precise start command is repo-specific and correctly deferred to run-time (the AGENTS.md / run skill knows it) — not a code placeholder.

**Scope-exception note (called out):** this plan edits `server/` — a deliberate, user-approved exception because the login page has no frontend. It is strictly limited to login presentation + `DEFAULT_BRAND.colors`; no auth/session/route/middleware logic is touched. Both tasks verified by the existing Python auth tests + a live login round-trip.

**Latent-bug note:** Task 1 fixes a real pre-existing bug (login rendered stale indigo after Phase 2 slimmed `brand.config`), not just a cosmetic retune — worth surfacing to the final review / user.
