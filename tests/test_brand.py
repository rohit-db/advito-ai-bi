import json
from server import brand


def test_load_brand_returns_config_values():
    b = brand.load_brand()
    assert b["identity"]["appName"] == "APEX"
    assert b["colors"]["primary"].startswith("#")


def test_load_brand_failsoft_on_missing_file(monkeypatch, tmp_path):
    # Point the loader at a nonexistent path -> must return defaults, not raise.
    monkeypatch.setattr(brand, "_BRAND_PATH", tmp_path / "nope.json")
    b = brand.load_brand()
    assert b == brand.DEFAULT_BRAND


def test_load_brand_failsoft_on_bad_json(monkeypatch, tmp_path):
    bad = tmp_path / "brand.config.json"
    bad.write_text("{ not valid json")
    monkeypatch.setattr(brand, "_BRAND_PATH", bad)
    assert brand.load_brand() == brand.DEFAULT_BRAND


def test_brand_color_helper():
    assert brand.brand_color("primary").startswith("#")
    assert brand.brand_color("nonexistent") == brand.DEFAULT_BRAND["colors"].get(
        "nonexistent", "#4f46e5"
    )
