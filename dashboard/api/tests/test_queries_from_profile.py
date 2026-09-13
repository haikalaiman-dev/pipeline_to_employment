import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fastapi.responses import JSONResponse

from dashboard.api import main, paths, profile, regions

REGION = {"id": "t", "label": "T", "queries": ["old"], "portals": [{"skill": "linkedin-search", "locations": ["Remote"], "flags": {}}]}


class QueriesFromProfile(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.patches = [mock.patch.object(paths, "REGIONS", root / "r.yaml"),
                        mock.patch.object(paths, "PROFILE_ANSWERS", root / "a.json"),
                        mock.patch.object(paths, "CLAUDE_MD", root / "c.md"),
                        mock.patch.object(paths, "PROFILE_MD", root / "p.md"),
                        mock.patch.object(paths, "SEARCH_QUERIES", root / "q.md")]
        for p in self.patches:
            p.start()
        regions.save([REGION])

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def test_409_without_profile_or_answers(self):
        res = main.post_queries_from_profile("t")
        self.assertIsInstance(res, JSONResponse)
        self.assertEqual(res.status_code, 409)
        self.assertEqual(json.loads(res.body)["error"], "no_profile_queries")

    def test_replaces_queries_from_answers(self):
        profile.write_answers({"target_titles": ["Data Analyst", "Backend Developer"], "key_skills": ["SQL"]})
        res = main.post_queries_from_profile("t")
        self.assertIsInstance(res, dict)
        self.assertEqual(res["queries"], ["Data Analyst", "Backend Developer", "SQL"])
        self.assertEqual(regions.get("t")["queries"], ["Data Analyst", "Backend Developer", "SQL"])

    def test_404_unknown_region(self):
        self.assertEqual(main.post_queries_from_profile("nope").status_code, 404)


if __name__ == "__main__":
    unittest.main()
