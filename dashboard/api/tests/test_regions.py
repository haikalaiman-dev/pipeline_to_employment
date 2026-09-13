import tempfile
import unittest
from pathlib import Path
from unittest import mock

from dashboard.api import paths, regions

REGION = {
    "id": "t", "label": "T", "queries": ["data analyst", "backend developer"],
    "portals": [
        {"skill": "linkedin-search", "locations": ["Example City", "Remote"], "flags": {"jobage": 14, "limit": 10}},
        {"skill": "freehire-search", "flags": {"region": "global", "no-description": True, "off": False}},
    ],
}


class BuildCommands(unittest.TestCase):
    def test_fan_out_is_query_times_location(self):
        cmds = regions.build_commands(REGION)
        self.assertEqual(len(cmds), 2 * 2 + 2)  # linkedin 2q x 2loc, freehire 2q
        li = [c for c in cmds if c["skill"] == "linkedin-search"]
        self.assertEqual(li[0]["argv"][:4], ["bun", "run", ".agents/skills/linkedin-search/cli/src/cli.ts", "search"])
        self.assertIn("--location", li[0]["argv"])
        self.assertEqual(li[0]["argv"][-2:], ["--format", "json"])
        self.assertEqual(li[0]["argv"][li[0]["argv"].index("--jobage") + 1], "14")

    def test_true_flag_is_bare_and_false_is_dropped(self):
        fh = [c for c in regions.build_commands(REGION) if c["skill"] == "freehire-search"][0]["argv"]
        self.assertIn("--no-description", fh)
        self.assertNotIn("--off", fh)
        self.assertNotIn("--location", fh)

    def test_portal_and_query_overrides(self):
        cmds = regions.build_commands(REGION, queries=["x"], portals=["freehire-search"])
        self.assertEqual([c["skill"] for c in cmds], ["freehire-search"])
        self.assertEqual(cmds[0]["query"], "x")


class Registry(unittest.TestCase):
    def test_validate_rejects_bad_ids_and_empty_portals(self):
        with self.assertRaises(ValueError):
            regions._validate({"id": "Bad Id", "portals": [{"skill": "x"}]})
        with self.assertRaises(ValueError):
            regions._validate({"id": "ok", "portals": []})

    def test_upsert_roundtrip(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(paths, "REGIONS", Path(d) / "r.yaml"):
            regions.upsert(REGION)
            regions.upsert({**REGION, "id": "u"})
            self.assertEqual([r["id"] for r in regions.load()], ["t", "u"])
            self.assertEqual(regions.get("u")["portals"][0]["locations"], ["Example City", "Remote"])

    def test_enabled_frontmatter_honoured(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(paths, "SKILLS", Path(d)):
            (Path(d) / "off").mkdir()
            (Path(d) / "off" / "SKILL.md").write_text("---\nname: off\nenabled: false  # demo\n---\n# x\n")
            (Path(d) / "on").mkdir()
            (Path(d) / "on" / "SKILL.md").write_text("---\nname: on\n---\n# x\n")
            self.assertFalse(regions.portal_enabled("off"))
            self.assertTrue(regions.portal_enabled("on"))
            self.assertTrue(regions.portal_enabled("missing"))  # missing key means enabled

    def test_shipped_registry_loads_and_targets_installed_portals(self):
        for r in regions.load():
            for p in r["portals"]:
                self.assertTrue(regions.portal_installed(p["skill"]), p["skill"])


if __name__ == "__main__":
    unittest.main()
