# PR2 — Login User/Operator Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the white-label `/login` page a segmented **"Sign in" (users) / "Operator"** toggle at the top that filters which sample-login chips show and applies a subtle operator visual cue — on a single URL, with the toggle being presentation-only (it can never change the role a session gets).

**Architecture:** Extend the existing server-rendered login (`server/auth/login.py`) — no new page, no SPA route. `users_repo.list_logins()` starts returning each chip's `role`; `_render_login_page` renders all chips but tags each with its role, adds a top segmented toggle, and client-side JS shows only the chips for the active mode. The active mode is remembered via `?mode=operator` query param (so a bookmarked/deep-linked operator view works) but the POST handler and role resolution are unchanged — role always comes from the user directory in `verify_login`, never from the form/toggle.

**Tech Stack:** FastAPI + server-rendered HTML/CSS/JS (f-string template) + pytest. Brand tokens from `brand.config.json` (PR1) already available in the template as `colors[...]`.

## Global Constraints

- **The toggle is presentation-only.** Role is resolved server-side in `verify_login()` from the directory. Nothing in the form, query param, or toggle may influence the role written to the session. A user account signing in via the "Operator" toggle still gets `role: "user"`. (Security invariant — the whole point.)
- **Single `/login` URL.** No `/login/operator` route (explicit user preference). Mode is a query param + client-side state only.
- **Fail-soft preserved.** Login still renders and works if `brand.config.json` is missing (PR1 loader defaults) and whether Lakebase is on or off.
- **Builds on PR1 state.** `login.py` already imports `load_brand()`, uses `colors[...]`/`app_name`/`tagline`/`mark`, and the operator seed user is `dana@apex.example` / tenant "All Clients" / `role: "operator"`. Do NOT reintroduce hardcoded colors or "Advito".
- **New env knob:** `AUTH_SHOW_DEMO_LOGINS` (default: show). When false, NO sample chips render (production posture), and the toggle still works for switching the visual mode / heading.
- **Commit after each task**, conventional-commit messages ending with a blank line then exactly `Co-authored-by: Isaac`.
- **No new dependencies.** Pytest exists; the frontend build is untouched by this PR (login is server-rendered).

---

## File structure

**Modify:**
- `server/auth/users.py` — `list_logins()` adds `role` to each dict (currently returns only `{name, tenant, email}`).
- `server/auth/login.py` — `_render_login_page(...)` gains a `mode` param, role-tagged chips, the segmented toggle markup + CSS + JS, operator cue, and the `AUTH_SHOW_DEMO_LOGINS` gate; `login_get` reads `?mode=`.
- `tests/test_login_toggle.py` — **create**: pytest for the render/filter/gate behavior.

**No frontend/ changes** (login is entirely server-rendered).

---

## Task 1: `list_logins()` exposes role

**Files:**
- Modify: `server/auth/users.py:217-235` (`list_logins`)
- Test: `tests/test_login_toggle.py` (create)

**Interfaces:**
- Produces: `list_logins() -> list[dict]` where each dict is `{"name": str, "tenant": str, "email": str, "role": str}` (role added; defaults to `"user"` if a row lacks one).

- [ ] **Step 1: Write the failing test**

Create `tests/test_login_toggle.py`:

```python
from server.auth import users as users_repo


def test_list_logins_includes_role():
    logins = users_repo.list_logins()
    assert logins, "expected at least one demo login in JSON fallback"
    for row in logins:
        assert set(["name", "tenant", "email", "role"]).issubset(row.keys())
    # The seeded operator (dana@apex.example) must be present with role operator.
    operators = [r for r in logins if r["role"] == "operator"]
    assert any(r["email"] == "dana@apex.example" for r in operators)
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `python -m pytest tests/test_login_toggle.py::test_list_logins_includes_role -v`
Expected: FAIL — `KeyError: 'role'` / assertion on missing `role` key.

- [ ] **Step 3: Add `role` to the returned dict**

In `server/auth/users.py`, change the `list_logins()` return comprehension (currently):

```python
    return [
        {"name": r.display_name, "tenant": r.tenant, "email": r.email}
        for r in rows
    ]
```

to:

```python
    return [
        {
            "name": r.display_name,
            "tenant": r.tenant,
            "email": r.email,
            "role": getattr(r, "role", "user") or "user",
        }
        for r in rows
    ]
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `python -m pytest tests/test_login_toggle.py::test_list_logins_includes_role -v`
Expected: PASS.

- [ ] **Step 5: Confirm no regression in the existing suite**

Run: `python -m pytest tests/ -q`
Expected: all pass (PR1's `test_brand.py` + this new test).

- [ ] **Step 6: Commit**

```bash
git add server/auth/users.py tests/test_login_toggle.py
git commit -m "feat(login): expose role in list_logins for chip filtering

Co-authored-by: Isaac"
```

---

## Task 2: Login toggle — render, filter, operator cue, demo-logins gate

**Files:**
- Modify: `server/auth/login.py` (`_render_login_page` + `login_get`)
- Test: `tests/test_login_toggle.py` (extend)

**Interfaces:**
- Consumes: `list_logins()` with `role` (Task 1); `load_brand()` (PR1).
- Produces: `_render_login_page(error=None, next_url="/", mode="user")` — `mode` is `"user"` or `"operator"`; renders the toggle, all chips (each tagged `data-role`), and a small script that shows only the active mode's chips. `login_get` reads `?mode=operator` and passes it through (validated to the two allowed values).

- [ ] **Step 1: Write the failing tests (behavior contract)**

Append to `tests/test_login_toggle.py`:

```python
from server.auth.login import _render_login_page


def test_render_has_mode_toggle():
    html_out = _render_login_page()
    # A segmented toggle with both modes is present.
    assert 'data-mode-toggle' in html_out
    assert 'data-mode="user"' in html_out
    assert 'data-mode="operator"' in html_out


def test_render_tags_chips_with_role():
    html_out = _render_login_page()
    # Chips carry their role so the client can filter them.
    assert 'data-role="operator"' in html_out
    assert 'data-role="user"' in html_out


def test_operator_mode_sets_operator_view():
    html_out = _render_login_page(mode="operator")
    # Operator mode marks the page so the cue + default-active toggle apply.
    assert 'data-active-mode="operator"' in html_out


def test_user_mode_is_default():
    html_out = _render_login_page()
    assert 'data-active-mode="user"' in html_out


def test_demo_logins_gate_hides_chips(monkeypatch):
    monkeypatch.setenv("AUTH_SHOW_DEMO_LOGINS", "false")
    html_out = _render_login_page()
    # No chips rendered when demo logins are disabled.
    assert 'class="chip"' not in html_out
    # But the sign-in form is still there.
    assert 'name="username"' in html_out
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `python -m pytest tests/test_login_toggle.py -v`
Expected: the 5 new tests FAIL (toggle markup / `mode` param / gate not implemented yet); `test_list_logins_includes_role` still passes.

- [ ] **Step 3: Implement the toggle, role-tagging, cue, and gate in `_render_login_page`**

Edit `server/auth/login.py`. Change the signature and body of `_render_login_page`:

1. **Signature:** `def _render_login_page(error: str | None = None, next_url: str = "/", mode: str = "user") -> str:`
2. **Normalize mode + gate:** at the top of the function, after `mark = ...`:

```python
    active_mode = "operator" if mode == "operator" else "user"
    show_demo = os.environ.get("AUTH_SHOW_DEMO_LOGINS", "true").strip().lower() not in ("0", "false", "no", "off")
```

3. **Role-tag the chips** (replace the existing `chips = "\n".join(...)` comprehension): add `data-role` from each login's role, and only build chips when `show_demo`:

```python
    chips = ""
    if show_demo:
        chips = "\n".join(
            f"""<button type="button" class="chip" data-role="{html.escape(u.get('role', 'user'))}" data-u="{html.escape(u['email'])}" data-p="{html.escape(demo_pw)}">
                  <span class="chip-name">{html.escape(u['name'])}</span>
                  <span class="chip-tenant">{html.escape(u['tenant'])}</span>
                  <span class="chip-cred">{html.escape(u['email'])}{(' &middot; ' + html.escape(demo_pw)) if demo_pw else ''}</span>
                </button>"""
            for u in users_repo.list_logins()
        )
```

4. **Add the toggle markup** immediately inside `<form ...>` before the `.brand` div — a two-button segmented control:

```html
    <div class="mode-toggle" data-mode-toggle>
      <button type="button" class="mode-btn" data-mode="user">Sign in</button>
      <button type="button" class="mode-btn" data-mode="operator">Operator</button>
    </div>
```

5. **Mark the page + card with the active mode** so CSS/JS can react: put `data-active-mode="{active_mode}"` on the `<body>` tag (e.g. `<body data-active-mode="{active_mode}">`).

6. **Add CSS** (inside the `<style>` block) for the toggle + operator cue + role-scoped chip visibility. Note doubled braces for literal CSS:

```css
  .mode-toggle {{ display:flex; gap:4px; background:#f1f5f9; border-radius:10px; padding:4px; margin-bottom:16px; }}
  .mode-btn {{ flex:1; border:0; background:transparent; padding:7px 10px; border-radius:7px;
              font-size:12.5px; font-weight:600; color:#64748b; cursor:pointer; }}
  .mode-btn.active {{ background:#fff; color:var(--brand); box-shadow:0 1px 2px rgba(0,0,0,.08); }}
  /* Operator cue: tint the logo ring + a small label when in operator mode. */
  body[data-active-mode="operator"] .brand h1::after {{
     content:" · Operator"; color:var(--brand); font-weight:600; font-size:12px; }}
  /* Chip visibility is driven by the active mode via a body attribute. */
  body[data-active-mode="user"] .chip[data-role="operator"] {{ display:none; }}
  body[data-active-mode="operator"] .chip[data-role="user"] {{ display:none; }}
```

7. **Add JS** (extend the existing `<script>`) to switch the active mode on click, mark the active button, and update the URL query param without reload:

```javascript
    (function() {{
      var body = document.body;
      function setMode(m) {{
        body.setAttribute("data-active-mode", m);
        document.querySelectorAll(".mode-btn").forEach(function(b) {{
          b.classList.toggle("active", b.dataset.mode === m);
        }});
        var u = new URL(window.location);
        if (m === "operator") u.searchParams.set("mode", "operator");
        else u.searchParams.delete("mode");
        window.history.replaceState({{}}, "", u);
      }}
      document.querySelectorAll("[data-mode-toggle] .mode-btn").forEach(function(b) {{
        b.addEventListener("click", function() {{ setMode(b.dataset.mode); }});
      }});
      setMode(body.getAttribute("data-active-mode") || "user");
    }})();
```

(The existing chip-click script stays; keep both.)

8. **`login_get`:** read the mode from the query string and pass it through:

```python
@router.get("/login")
async def login_get(request: Request) -> Response:
    if verify_session(request.cookies.get(SESSION_COOKIE)):
        return RedirectResponse("/", status_code=303)
    next_url = _safe_next(request.query_params.get("next", "/"))
    mode = "operator" if request.query_params.get("mode") == "operator" else "user"
    return HTMLResponse(_render_login_page(next_url=next_url, mode=mode))
```

9. **`login_post` error re-render:** pass the submitted mode through so a failed login stays on the same toggle. Read `mode` from the form (add a hidden input `<input type="hidden" name="mode" value="{active_mode}">` inside the form) and in `login_post`:

```python
    mode = "operator" if str(form.get("mode", "")) == "operator" else "user"
    ...
    return HTMLResponse(_render_login_page(error="Invalid email or password.", next_url=next_url, mode=mode), status_code=401)
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `python -m pytest tests/test_login_toggle.py -v`
Expected: all tests PASS (Task 1's + the 5 new ones).

- [ ] **Step 5: Verify the render is valid + the security invariant holds**

Run:
```bash
python -c "from server.auth.login import _render_login_page as f; h=f(mode='operator'); assert 'data-active-mode=\"operator\"' in h and 'Operator' in h; print('operator render ok', len(h))"
python -c "from server.auth.login import _render_login_page as f; h=f(); assert h.count('name=\"mode\"')==1; print('hidden mode field present')"
```
Expected: both print success. (The hidden `mode` field is presentation state for error re-render — it is NOT read into the session; role still comes from `verify_login`.)

- [ ] **Step 6: Confirm the role-resolution path is unchanged (invariant check)**

Read `login_post` and confirm the `identity["role"]` is still `user.role` (from `verify_login`), NOT from `form.get("mode")`. This is a read-only confirmation — the diff must not wire `mode` into `identity`.

- [ ] **Step 7: Full suite + import sanity**

Run: `python -m pytest tests/ -q` and `python -c "import app; print('ok')"`
Expected: all pass; import ok.

- [ ] **Step 8: Commit**

```bash
git add server/auth/login.py tests/test_login_toggle.py
git commit -m "feat(login): user/operator toggle with role-filtered chips + demo-logins gate

Single /login URL, presentation-only toggle (role still resolved server-side
from the directory). Adds AUTH_SHOW_DEMO_LOGINS gate.

Co-authored-by: Isaac"
```

---

## Task 3: Document the new env knob + manual visual check

**Files:**
- Modify: `.env.example` (add `AUTH_SHOW_DEMO_LOGINS`)
- Modify: `docs/customizing.md` (add the knob to the Change-X→edit-Y table)

- [ ] **Step 1: Add the env var to `.env.example`**

In the "White-label login (OEM IdP)" group of `.env.example`, add:

```
# Show the sample-login chips on the /login page (demo convenience). Set false
# for production so no demo accounts are advertised. The user/operator toggle
# still works either way.
AUTH_SHOW_DEMO_LOGINS=true
```

- [ ] **Step 2: Add to the docs table**

In `docs/customizing.md`, add a row to the "Change X → edit Y" table:

```
| Login demo chips on/off | `AUTH_SHOW_DEMO_LOGINS` env |
```

- [ ] **Step 3: Manual visual check (controller-run, documented)**

Run backend with `AUTH_ENABLED=true LAKEBASE_ENABLED=false`; open `/login`. Confirm: the toggle shows "Sign in" / "Operator"; user mode lists only non-operator chips; clicking "Operator" shows only the operator chip, adds the "· Operator" cue, and updates the URL to `?mode=operator`; a chip click fills the form; a real login still lands with the directory role. Then `AUTH_SHOW_DEMO_LOGINS=false` → no chips, form still works. (This step is verification, not code — record the result.)

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/customizing.md
git commit -m "docs(login): document AUTH_SHOW_DEMO_LOGINS knob

Co-authored-by: Isaac"
```

---

## Self-review notes

- **Spec coverage (Section B):** single `/login` with top toggle ✓ (T2); role-filtered chips ✓ (T1 exposes role, T2 filters); operator visual cue ✓ (T2 CSS); presentation-only / no privilege escalation ✓ (T2 Step 6 invariant check — role from `verify_login`, not the toggle); one shared template ✓ (same `_render_login_page`); `AUTH_SHOW_DEMO_LOGINS` knob ✓ (T2 + T3 docs). No separate `/login/operator` URL ✓ (mode is a query param).
- **Builds on PR1:** uses the existing `load_brand()`/`colors[...]` template; no hardcoded colors reintroduced; operator seed is `dana@apex.example`.
- **Type consistency:** `list_logins()` dict gains `role` (T1), consumed by the chip comprehension (T2). `_render_login_page(mode=...)` signature (T2) consumed by `login_get`/`login_post` (T2).
- **Testing honesty:** the login is server-rendered, so pytest on the HTML string + the render functions is the right gate (no browser unit test needed); the interactive toggle behavior gets the documented manual check in T3.
- **Out of scope:** the SPA `useUser`/Header already reads role from `/api/auth/me` (unchanged); admin gating is unchanged (PR3 territory). This PR only touches the login surface.
