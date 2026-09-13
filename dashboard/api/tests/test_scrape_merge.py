import re
import unittest
from datetime import date

from dashboard.api import paths
from dashboard.api.scrape import merge_results

import job_key

TODAY = date(2026, 9, 12)
RESULTS = [
    {"id": "1", "title": "Data Analyst", "company": "Acme", "location": "Example City", "date": "2026-09-10", "url": "https://x/1"},
    {"id": "2", "title": "Backend Developer", "company": "Beta", "location": "Remote", "date": None, "url": "https://x/2/"},
    {"id": "3", "title": "Old Job", "company": "Gamma", "location": "Remote", "date": "2026-08-01", "url": "https://x/3"},
    {"id": "4", "title": "Tracked Role", "company": "Delta", "location": "Remote", "date": "2026-09-11T08:00:00Z", "url": "https://x/4"},
    {"id": "5", "title": "", "company": "Eps", "location": "Remote", "date": "2026-09-11", "url": "https://x/5"},
]


def step4_fields() -> set[str]:
    """Derive the storage schema from upstream's spec, like tests/test_scrape_contract.py does."""
    text = (paths.REPO / ".claude/skills/job-scraper/SKILL.md").read_text(encoding="utf-8")
    block = re.search(r"Add ALL fetched jobs.*?```json(.*?)```", text, re.DOTALL).group(1)
    return set(re.findall(r'"([a-z_]+)":', block)) - {"seen"}  # `seen` is the map, not an entry field


class Merge(unittest.TestCase):
    def merge(self, seen, results=RESULTS, tracker=frozenset()):
        return merge_results(seen, results, portal="linkedin-search", region="remote", today=TODAY, tracker=set(tracker))

    def test_counts_and_idempotency(self):
        seen = {}
        c = self.merge(seen, tracker={("delta", "trackedrole")})
        self.assertEqual((c["new"], c["skipped"], c["stale"], c["invalid"]), (2, 1, 1, 1))
        self.assertEqual(len(seen), 3)
        again = self.merge(seen, tracker={("delta", "trackedrole")})
        self.assertEqual(again["new"] + again["skipped"], 0)
        self.assertEqual(again["duplicate"], 3)

    def test_entry_shape_matches_step4_schema(self):
        seen = {}
        self.merge(seen)
        entry = seen[job_key.make_key("Acme", "Data Analyst", "https://x/1")]
        self.assertTrue(step4_fields() <= set(entry), step4_fields() - set(entry))
        self.assertEqual(entry["status"], "new")
        self.assertEqual(entry["posted_date"], "2026-09-10")
        self.assertEqual(entry["first_seen"], "2026-09-12")
        self.assertEqual(entry["portal"], "linkedin-search")
        self.assertEqual(entry["source"], "cli")
        self.assertEqual(entry["region"], "remote")
        self.assertIsNone(entry["fit"])
        self.assertIsNone(entry["deadline"])

    def test_datetime_string_truncates_to_iso_date_and_null_kept(self):
        seen = {}
        self.merge(seen, tracker={("delta", "trackedrole")})
        self.assertEqual(seen[job_key.make_key("Delta", "Tracked Role", "https://x/4")]["posted_date"], "2026-09-11")
        self.assertIsNone(seen[job_key.make_key("Beta", "Backend Developer", "https://x/2/")]["posted_date"])

    def test_legacy_key_matched_by_url(self):
        seen = {"legacy-key": {"title": "Data Analyst", "company": "Acme", "url": "https://x/1", "status": "ranked"}}
        c = self.merge(seen, [RESULTS[0]])
        self.assertEqual(c["duplicate"], 1)
        self.assertEqual(len(seen), 1)


if __name__ == "__main__":
    unittest.main()
