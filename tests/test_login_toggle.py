from server.auth import users as users_repo
from server.auth.login import _render_login_page


def test_list_logins_includes_role(monkeypatch):
    # Disable Lakebase to force JSON fallback (seeded users)
    monkeypatch.setattr(users_repo, "LAKEBASE_ENABLED", False)

    logins = users_repo.list_logins()
    assert logins, "expected at least one demo login in JSON fallback"
    for row in logins:
        assert set(["name", "tenant", "email", "role"]).issubset(row.keys())
    # The seeded operator (dana@apex.example) must be present with role operator.
    operators = [r for r in logins if r["role"] == "operator"]
    assert any(r["email"] == "dana@apex.example" for r in operators)


def test_render_has_mode_toggle(monkeypatch):
    monkeypatch.setattr(users_repo, "LAKEBASE_ENABLED", False)
    html_out = _render_login_page()
    # A segmented toggle with both modes is present.
    assert 'data-mode-toggle' in html_out
    assert 'data-mode="user"' in html_out
    assert 'data-mode="operator"' in html_out


def test_render_tags_chips_with_role(monkeypatch):
    monkeypatch.setattr(users_repo, "LAKEBASE_ENABLED", False)
    html_out = _render_login_page()
    # Chips carry their role so the client can filter them.
    assert 'data-role="operator"' in html_out
    assert 'data-role="user"' in html_out


def test_operator_mode_sets_operator_view(monkeypatch):
    monkeypatch.setattr(users_repo, "LAKEBASE_ENABLED", False)
    html_out = _render_login_page(mode="operator")
    # Operator mode marks the page so the cue + default-active toggle apply.
    assert 'data-active-mode="operator"' in html_out


def test_user_mode_is_default(monkeypatch):
    monkeypatch.setattr(users_repo, "LAKEBASE_ENABLED", False)
    html_out = _render_login_page()
    assert 'data-active-mode="user"' in html_out


def test_demo_logins_gate_hides_chips(monkeypatch):
    monkeypatch.setattr(users_repo, "LAKEBASE_ENABLED", False)
    monkeypatch.setenv("AUTH_SHOW_DEMO_LOGINS", "false")
    html_out = _render_login_page()
    # No chips rendered when demo logins are disabled.
    assert 'class="chip"' not in html_out
    # But the sign-in form is still there.
    assert 'name="username"' in html_out
