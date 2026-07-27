from server.auth import users as users_repo


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
