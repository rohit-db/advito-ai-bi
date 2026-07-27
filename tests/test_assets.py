import json
from pathlib import Path

from server.assets import registry as assets


def test_load_registry_has_seed_assets():
    reg = assets.load_registry()
    a = reg["assets"]
    assert "spend" in a and "sustainability" in a
    assert a["spend"]["label"] == "Spend"
    assert a["spend"]["dashboardId"] == "01f1271698161d42b3c66528415775e8"
    # per-page Genie prompts moved off ROUTES into the seed
    spend_summary = next(p for p in a["spend"]["pages"] if p["pageId"] == "summary")
    assert "SPEND" in spend_summary["summaryPrompt"].upper()
    assert len(spend_summary["suggestions"]) == 3


def test_dashboard_ids_are_deduped():
    # spend + sustainability share one physical dashboard id -> one entry
    assert assets.dashboard_ids() == ["01f1271698161d42b3c66528415775e8"]


def test_default_dashboard_id():
    assert assets.default_dashboard_id() == "01f1271698161d42b3c66528415775e8"


def test_catalog_dashboards_shape():
    cat = assets.catalog_dashboards()
    assert cat == [{"id": "01f1271698161d42b3c66528415775e8", "name": "Spend"}]


def test_load_registry_failsoft_on_missing_file(monkeypatch, tmp_path):
    monkeypatch.setattr(assets, "_SEED_PATH", str(tmp_path / "nope.json"))
    assets._cache = None  # bypass any cached parse
    reg = assets.load_registry()
    assert reg == {"assets": {}}
    assert assets.dashboard_ids() == []
    assert assets.default_dashboard_id() is None


def test_load_registry_failsoft_on_bad_json(monkeypatch, tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{ not valid json ")
    monkeypatch.setattr(assets, "_SEED_PATH", str(bad))
    assets._cache = None
    assert assets.load_registry() == {"assets": {}}
